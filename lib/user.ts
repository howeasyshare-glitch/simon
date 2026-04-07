export function getAnonId() {
  if (typeof window === "undefined") return "";

  let anonId = localStorage.getItem("findoutfit_anon_id");
  if (!anonId) {
    anonId = crypto.randomUUID();
    localStorage.setItem("findoutfit_anon_id", anonId);
  }
  return anonId;
}
