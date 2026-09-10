import axios from "axios";

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 120 * 1000,
});

export default instance;

/** Pull a readable message out of whatever the API or network threw. */
export function error_message(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string" && detail.trim() !== "") {
      return detail;
    }

    return error.message || fallback;
  }

  return fallback;
}
