import { useState } from "react";
import { Sparkles } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

type EvidencePart = { id: number; name: string; price: number; stock: number };

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const config = trpc.assistant.config.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const mutation = trpc.assistant.ask.useMutation({
    onSuccess: result => setMessages(previous => [...previous, { role: "assistant", content: result.answer }]),
  });
  const result = mutation.data;
  const configReady = !!config.data && !config.error && !config.isFetching;
  const dataMode = configReady ? (result?.dataMode ?? config.data?.dataMode) : undefined;
  const isShop = dataMode === "shop";
  const evidence = new Map<number, EvidencePart>();
  for (const entry of result?.trace ?? []) {
    if (entry.status !== "ok") continue;
    const rows = Array.isArray(entry.result) ? entry.result : [entry.result];
    for (const row of rows) {
      if (row && typeof row === "object" && "id" in row && "name" in row && "price" in row && "stock" in row
          && typeof row.id === "number" && typeof row.name === "string"
          && typeof row.price === "number" && typeof row.stock === "number") {
        evidence.set(row.id, row as EvidencePart);
      }
    }
  }
  const sources = (result?.sources ?? []).map(id => evidence.get(id)).filter((part): part is EvidencePart => !!part);

  function send(question: string) {
    if (mutation.isPending || !configReady) return;
    setMessages(previous => [...previous, { role: "user", content: question }]);
    mutation.reset();
    mutation.mutate({ question });
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/15 p-3"><Sparkles className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">ผู้ช่วยร้าน / Shop assistant</h1>
            <p className="mt-1 text-sm text-muted-foreground">{dataMode
              ? isShop ? "Search the local shop inventory for prices, products and current stock." : "Explore prices, parts and low stock in an invented sample catalog. This assistant is separate from your real shop inventory."
              : "Confirming which inventory this assistant uses."}</p>
            <Badge variant="secondary" className="mt-2">{dataMode ? `${isShop ? "Shop inventory" : "Sample catalog"} · Read only · Class model` : config.error ? "Inventory mode unavailable" : "Checking inventory mode…"}</Badge>
          </div>
        </div>
        {dataMode && <Alert><AlertDescription>{isShop
          ? "Your question and selected product details (ID, name, SKU, category, price, stock and minimum stock) are sent to the configured course proxy. Stock is read from the local shop database for each question. The assistant cannot change inventory. Motorcycle fitment is not verified."
          : "Questions and invented sample lookup results are sent to the configured course proxy. Real shop inventory is not queried in sample mode. Keep private business information out of sample questions. Motorcycle fitment is not verified."}</AlertDescription></Alert>}
        {config.error && <Alert variant="destructive" role="alert"><AlertDescription>
          Could not confirm the assistant inventory mode. {config.error.message}
          <Button variant="outline" size="sm" className="ml-2" onClick={() => config.refetch()}>Retry</Button>
        </AlertDescription></Alert>}
        {!dataMode && !config.error && <Alert role="status"><AlertDescription>Loading assistant configuration before enabling questions…</AlertDescription></Alert>}
        {mutation.error && <Alert variant="destructive" role="alert"><AlertDescription>{mutation.error.message}</AlertDescription></Alert>}
        {dataMode && <AIChatBox messages={messages} onSendMessage={send} isLoading={mutation.isPending}
          height="560px" placeholder={`Ask a complete ${isShop ? "shop inventory" : "sample catalog"} question (up to 1000 characters)...`}
          emptyStateMessage={`What would you like to check in the ${isShop ? "shop inventory" : "sample catalog"}?`}
          suggestedPrompts={["Which parts are low on stock?", "Show motor oil under 300 baht.", "What are the inventory totals?"]} />}
        {result && dataMode && (
          <Card><CardContent className="space-y-4 pt-5">
            <details open={sources.length > 0}>
              <summary className="cursor-pointer text-sm font-medium">{result.dataMode === "shop" ? "Shop inventory sources" : "Sample sources"} from the latest answer ({sources.length})</summary>
              {sources.length ? <div className="mt-3 overflow-x-auto"><Table>
                <TableHeader><TableRow><TableHead>Part ID</TableHead><TableHead>Product</TableHead><TableHead>Price (THB)</TableHead><TableHead>{result.dataMode === "shop" ? "Current stock at lookup" : "Sample stock"}</TableHead></TableRow></TableHeader>
                <TableBody>{sources.map(part => <TableRow key={part.id}><TableCell>{part.id}</TableCell><TableCell>{part.name}</TableCell><TableCell>{part.price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</TableCell><TableCell>{part.stock}</TableCell></TableRow>)}</TableBody>
              </Table></div> : <p className="mt-2 text-sm text-muted-foreground">No individual part citations. Aggregate evidence, when used, appears in the lookup details.</p>}
            </details>
            <details>
              <summary className="cursor-pointer text-sm font-medium">Lookup details ({result.trace.length})</summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">{JSON.stringify(result.trace, null, 2)}</pre>
            </details>
          </CardContent></Card>
        )}
      </div>
    </DashboardLayout>
  );
}
