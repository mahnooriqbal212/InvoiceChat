import { toast } from "sonner";

export async function copyPaymentLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Payment link copied");
  } catch {
    toast.error("Could not copy. Open the invoice and copy the link by hand.");
  }
}
