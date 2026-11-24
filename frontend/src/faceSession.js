// Is login session mein face check ho chuka hai ya nahi.
// Token badalte hi (naya login) flag apne aap invalid ho jata hai.

const KEY = "codeshield_face_ok";

const tokenTag = () =>
  (localStorage.getItem("codeshield_token") || "").slice(-24);

export function isFaceVerifiedThisSession() {
  const tag = tokenTag();

  return Boolean(tag) && sessionStorage.getItem(KEY) === tag;
}

export function markFaceVerified() {
  sessionStorage.setItem(KEY, tokenTag());
}