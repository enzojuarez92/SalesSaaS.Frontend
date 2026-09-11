import { api } from "./api";
export async function download(url: string, filename: string, params?: object) {
  const { data } = await api.get(url, { params, responseType: "blob" });
  const href = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}
