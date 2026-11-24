import { useEffect, useState } from "react";

const API_BASE = "http://localhost:5000";

// Backend na mile ya list khaali aaye to kam se kam C++ hamesha dikhe
const FALLBACK = [{ id: "cpp", label: "C++" }];

/*
  Backend (/api/languages) batata hai ki kaunsi languages sandbox mein sach mein
  chalti hain. Editor ka dropdown isi list se banao, taaki jo language chalti
  nahi wo student ko dikhe hi nahi.
*/
export default function useLanguages() {
  const [languages, setLanguages] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/languages`)
      .then((response) => response.json())
      .then((data) => {
        if (
          !cancelled &&
          Array.isArray(data.languages) &&
          data.languages.length > 0
        ) {
          setLanguages(data.languages);
        }
      })
      .catch(() => {
        /* FALLBACK (sirf C++) chalega */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return languages;
}