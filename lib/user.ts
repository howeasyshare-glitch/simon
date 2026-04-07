export function getUserId() {
  if (typeof window === "undefined") return null;

  let id = localStorage.getItem("findoutfit_user_id");

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("findoutfit_user_id", id);
  }

  return id;
}
