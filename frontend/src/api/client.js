import axios from "axios";

export const api = axios.create({
  // Falls back to the local FastAPI server if VITE_API_URL is missing
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 60000, // AI calls can take a few seconds
});

// Turns any axios error into one short sentence for a toast.
// FastAPI sends {"detail": "text"} for our own errors and {"detail": [ ... ]} for validation errors.
export function getErrorMessage(error) {
  if (!error.response) {
    return "Cannot reach the server. Is the backend running?";
  }
  const detail = error.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    const field = (first.loc || []).filter((part) => part !== "body").join(" → ");
    const message = String(first.msg || "Invalid value").replace(/^Value error, /, "");
    return field ? `${field}: ${message}` : message;
  }
  return `Something went wrong (error ${error.response.status}).`;
}
