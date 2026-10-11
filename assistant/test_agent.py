import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

try:
    from .agent import AssistantError, Catalog, MODEL, ask, validate_arguments, validate_final
except ImportError:
    from agent import AssistantError, Catalog, MODEL, ask, validate_arguments, validate_final


PART = {"id": 1, "name": "Motor oil", "sku": "OIL-1", "category": "oil",
        "price": 200.0, "stock": 4, "minStock": 5, "description": "10W-40"}


def completion(content=None, calls=()):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(
        content=content, tool_calls=[SimpleNamespace(id=str(index), function=SimpleNamespace(
            name=name, arguments=arguments)) for index, (name, arguments) in enumerate(calls)]))])


class FakeClient:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.requests = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.requests.append(copy.deepcopy(kwargs))
        return next(self.responses)


class FakeCatalog:
    is_synthetic = True

    def __init__(self):
        self.calls = []

    def search_parts(self, **kwargs):
        self.calls.append(("search_parts", kwargs))
        return [dict(PART)]

    def get_part(self, part_id):
        self.calls.append(("get_part", part_id))
        return dict(PART) if part_id == 1 else None

    def get_low_stock(self):
        self.calls.append(("get_low_stock", {}))
        return [dict(PART)]

    def inventory_summary(self):
        self.calls.append(("inventory_summary", {}))
        return {"total_parts": 1, "total_units": 4}


class AgentTests(unittest.TestCase):
    def test_native_tool_round_trip_and_sources(self):
        catalog = FakeCatalog()
        client = FakeClient([
            completion(calls=[("search_parts", '{"query":"oil","max_price":300,"limit":5}')]),
            completion('{"answer":"Motor oil is 200 THB, stock 4.","sources":[1]}'),
        ])
        result = ask("Oil under 300?", catalog, client)
        self.assertEqual(result["sources"], [1])
        self.assertEqual(result["trace"][0]["result"][0]["price"], 200)
        self.assertEqual(client.requests[0]["model"], MODEL)
        self.assertEqual(client.requests[1]["messages"][-2]["tool_calls"][0]["function"]["name"], "search_parts")
        self.assertEqual(client.requests[1]["messages"][-1]["role"], "tool")

    def test_arguments_validate_schema_and_types(self):
        invalid = [
            ("delete_part", "{}"), ("search_parts", "not JSON"), ("search_parts", "[]"),
            ("search_parts", '{"sql":"DELETE FROM parts"}'),
            ("search_parts", '{"limit":true}'), ("search_parts", '{"limit":21}'),
            ("search_parts", '{"max_price":NaN}'), ("search_parts", '{"max_price":-1}'),
            ("search_parts", '{"min_stock":1.2}'), ("search_parts", '{"category":null}'),
            ("get_part", "{}"), ("get_part", '{"part_id":0}'),
            ("get_low_stock", '{"limit":2}'), ("search_parts", json.dumps({"query": "x" * 201})),
        ]
        for name, arguments in invalid:
            with self.subTest(name=name, arguments=arguments):
                with self.assertRaises((ValueError, TypeError)):
                    validate_arguments(name, arguments)
        self.assertEqual(validate_arguments("get_part", '{"part_id":1}'), {"part_id": 1})

    def test_invalid_tools_do_not_dispatch(self):
        catalog = FakeCatalog()
        client = FakeClient([
            completion(calls=[("delete_part", '{"part_id":1}'), ("get_part", '{"part_id":true}')]),
            completion('{"answer":"Please clarify the part.","sources":[]}'),
        ])
        result = ask("Delete a part", catalog, client)
        self.assertEqual(catalog.calls, [])
        self.assertTrue(all(row["status"] == "error" for row in result["trace"]))

    def test_repeated_normalized_queries_are_blocked(self):
        catalog = FakeCatalog()
        client = FakeClient([
            completion(calls=[("search_parts", '{"query":"Oil"}')]),
            completion(calls=[("search_parts", '{"query":" oil  "}')]),
            completion('{"answer":"Motor oil is available.","sources":[1]}'),
        ])
        result = ask("oil", catalog, client)
        self.assertEqual(len(catalog.calls), 1)
        self.assertEqual(result["trace"][1]["status"], "blocked")

    def test_low_stock_and_aggregate_tools_remain_read_only(self):
        catalog = FakeCatalog()
        client = FakeClient([
            completion(calls=[("get_low_stock", "{}"), ("inventory_summary", "{}")]),
            completion('{"answer":"One part is low on stock; total stock is four units.","sources":[1]}'),
        ])
        result = ask("low stock and totals", catalog, client)
        self.assertEqual([call[0] for call in catalog.calls], ["get_low_stock", "inventory_summary"])
        self.assertEqual(result["sources"], [1])

    def test_catalog_failure_never_leaks_exception_text(self):
        catalog = FakeCatalog()
        catalog.search_parts = Mock(side_effect=RuntimeError("secret-key"))
        client = FakeClient([
            completion(calls=[("search_parts", '{"query":"oil"}')]),
            completion('{"answer":"The catalog lookup failed; please retry.","sources":[]}'),
        ])
        result = ask("oil", catalog, client)
        self.assertEqual(result["trace"][0]["status"], "error")
        self.assertNotIn("secret-key", json.dumps(result))

    def test_unverified_citation_gets_one_repair(self):
        client = FakeClient([
            completion(calls=[("get_part", '{"part_id":1}')]),
            completion('{"answer":"Oil","sources":[999]}'),
            completion('{"answer":"Motor oil is 200 THB.","sources":[1]}'),
        ])
        result = ask("oil", FakeCatalog(), client)
        self.assertEqual(result["sources"], [1])
        self.assertEqual(client.requests[-1]["tool_choice"], "none")

    def test_source_position_error_repairs_to_actual_part_ids(self):
        catalog = FakeCatalog()
        catalog.get_low_stock = lambda: [{**PART, "id": part_id} for part_id in (7, 16, 25, 26)]
        client = FakeClient([
            completion(calls=[("get_low_stock", "{}")]),
            completion('{"answer":"Four parts have low stock.","sources":[1]}'),
            completion('{"answer":"Four parts have low stock.","sources":[7,16,25,26]}'),
        ])
        result = ask("Which parts are low on stock?", catalog, client)
        self.assertEqual(result["sources"], [7, 16, 25, 26])
        repair = client.requests[-1]["messages"][-1]["content"]
        self.assertIn("Allowed part IDs: [7, 16, 25, 26]", repair)
        self.assertIn("Validation error:", repair)

    def test_aggregate_source_zero_error_explicitly_requires_empty_list(self):
        client = FakeClient([
            completion(calls=[("inventory_summary", "{}")]),
            completion('{"answer":"There is one part and four units.","sources":[0]}'),
            completion('{"answer":"There is one part and four units.","sources":[]}'),
        ])
        result = ask("inventory totals?", FakeCatalog(), client)
        self.assertEqual(result["sources"], [])
        self.assertIn("sources must be []", client.requests[-1]["messages"][-1]["content"])

    def test_no_tool_shop_claims_are_rejected_even_with_valid_json(self):
        client = FakeClient([completion('{"answer":"Motor oil costs 999 THB, stock 99.","sources":[]}')])
        result = ask("oil price and stock?", FakeCatalog(), client)
        self.assertIn("could not complete", result["answer"])
        self.assertNotIn("999", result["answer"])
        self.assertEqual(result["sources"], [])

    def test_product_evidence_requires_citations_even_alongside_aggregate(self):
        client = FakeClient([
            completion(calls=[("get_part", '{"part_id":1}'), ("inventory_summary", "{}")]),
            completion('{"answer":"Motor oil is 200 THB.","sources":[]}'),
            completion('{"answer":"Motor oil is 200 THB.","sources":[1]}'),
        ])
        result = ask("oil price", FakeCatalog(), client)
        self.assertEqual(result["sources"], [1])
        self.assertEqual(len(client.requests), 3)

    def test_aggregate_and_no_match_evidence_allow_empty_sources(self):
        for tool, arguments, answer in (
            ("inventory_summary", "{}", "There is one part and four units."),
            ("get_part", '{"part_id":999}', "No matching part was found."),
        ):
            with self.subTest(tool=tool):
                client = FakeClient([completion(calls=[(tool, arguments)]),
                                     completion(json.dumps({"answer": answer, "sources": []}))])
                result = ask("check inventory", FakeCatalog(), client)
                self.assertEqual(result["answer"], answer)
                self.assertEqual(result["sources"], [])

    def test_cli_forces_utf8_output_on_windows_code_pages(self):
        program = (
            "import io, sys; "
            "from assistant import agent; "
            "agent.Catalog=lambda **kwargs: object(); "
            "agent.ask=lambda *args,**kwargs: {'answer':'ยางใน','sources':[],'trace':[]}; "
            "sys.stdin=io.TextIOWrapper(io.BytesIO(b'{\\\"question\\\":\\\"tube\\\"}\\n'),encoding='cp1252'); "
            "raise SystemExit(agent.main())"
        )
        environment = {**os.environ, "PYTHONIOENCODING": "cp1252"}
        completed = subprocess.run([sys.executable, "-c", program],
                                   cwd=Path(__file__).resolve().parents[1], env=environment,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10, check=True)
        self.assertEqual(json.loads(completed.stdout.decode("utf-8"))["answer"], "ยางใน")

    def test_malformed_json_repair_is_bounded(self):
        client = FakeClient([completion("not JSON"), completion('{"answer":"Still invalid"}')])
        result = ask("hello", FakeCatalog(), client)
        self.assertIn("could not complete", result["answer"])
        self.assertEqual(len(client.requests), 2)

    def test_model_turn_cap(self):
        catalog = FakeCatalog()
        client = FakeClient([completion(calls=[("get_part", json.dumps({"part_id": index}))])
                             for index in range(1, 5)])
        result = ask("keep looking", catalog, client)
        self.assertEqual(len(client.requests), 4)
        self.assertEqual(len(catalog.calls), 3)
        self.assertEqual(client.requests[-1]["tool_choice"], "none")
        self.assertEqual(result["sources"], [])

    def test_tool_call_cap(self):
        catalog = FakeCatalog()
        calls = [("get_part", json.dumps({"part_id": index})) for index in range(1, 8)]
        client = FakeClient([completion(calls=calls)])
        result = ask("all parts", catalog, client)
        self.assertEqual(catalog.calls, [])
        self.assertEqual(result["sources"], [])

    def test_final_schema_rejects_extra_fields_bool_and_duplicate_sources(self):
        for payload in ({"answer": "x", "sources": [True]}, {"answer": "x", "sources": [1, 1]},
                        {"answer": "x", "sources": [], "extra": 1}, {"answer": "", "sources": []}):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                validate_final(json.dumps(payload), {1})

    def test_configuration_required_without_public_endpoint_fallback(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(AssistantError, "OPENAI_BASE_URL"):
            ask("oil", FakeCatalog())

    def test_database_catalog_rejected_before_client_construction(self):
        sdk = Mock(side_effect=AssertionError("Client must not be constructed"))
        with patch.dict(sys.modules, {"openai": SimpleNamespace(OpenAI=sdk)}):
            with self.assertRaisesRegex(AssistantError, "invented sample catalog"):
                ask("inventory totals", Catalog(database_path="private-shop.db"))
        sdk.assert_not_called()

    def test_unmarked_fixture_rejected_and_temporary_synthetic_fixture_allowed(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            fixture = Path(directory) / "catalog.json"
            fixture.write_text(json.dumps({"parts": [PART]}), encoding="utf-8")
            blocked_client = FakeClient([])
            with self.assertRaisesRegex(AssistantError, "invented sample catalog"):
                ask("oil", Catalog(fixture_path=fixture), blocked_client)
            self.assertEqual(blocked_client.requests, [])
            fixture.write_text(json.dumps({"synthetic": True, "parts": [PART]}), encoding="utf-8")
            client = FakeClient([completion(calls=[("get_part", '{"part_id":1}')]),
                                 completion('{"answer":"Sample motor oil is 200 THB.","sources":[1]}')])
            self.assertEqual(ask("oil", Catalog(fixture_path=fixture), client)["sources"], [1])

    def test_cli_rejects_database_path_without_network_or_path_disclosure(self):
        completed = subprocess.run([sys.executable, "-m", "assistant.agent"],
                                   input=json.dumps({"question": "inventory totals", "database_path": "private-shop.db"}).encode(),
                                   cwd=Path(__file__).resolve().parents[1],
                                   env={**os.environ, "OPENAI_API_KEY": "", "OPENAI_BASE_URL": ""},
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        self.assertEqual(completed.returncode, 1)
        self.assertEqual(json.loads(completed.stdout), {"error": "Invalid assistant request."})
        self.assertNotIn(b"private-shop", completed.stdout + completed.stderr)

    def test_input_bounds_and_upstream_errors_are_safe(self):
        for question in (None, "", " ", "x" * 1001):
            with self.subTest(question=question), self.assertRaises(AssistantError):
                ask(question, FakeCatalog(), FakeClient([]))
        with self.assertRaisesRegex(AssistantError, "course model is unavailable") as caught:
            ask("oil", FakeCatalog(), FakeClient([]))
        self.assertNotIn("StopIteration", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
