import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listVehicleDocuments } from "@/lib/services/documents";
import { requireUser } from "@/lib/session";
import { DocumentUpload, RemoveDocumentButton } from "./documents";

function calendarDate(value: Date | null) {
  if (!value) return "—";
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBytes(value: bigint) {
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)} KB`;
}

export async function VehicleDocuments({ vehicleId }: { vehicleId: string }) {
  const user = await requireUser();
  const documents = await listVehicleDocuments(user.id, vehicleId);

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold">Documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, JPEG, PNG, or WebP, up to 1 MB. Files are stored privately and downloaded through an authorized link.
        </p>
      </div>
      <DocumentUpload vehicleId={vehicleId} />
      {documents.length === 0 ? (
        <EmptyState title="No documents" description="Registration, insurance, and permits for this vehicle appear here." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <a href={`/api/documents/${item.id}`} className="font-medium underline-offset-4 hover:underline">
                    {item.filename}
                  </a>
                </TableCell>
                <TableCell>{formatBytes(item.byteSize)}</TableCell>
                <TableCell>{calendarDate(item.expiresOn)}</TableCell>
                <TableCell>
                  <RemoveDocumentButton vehicleId={vehicleId} documentId={item.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
