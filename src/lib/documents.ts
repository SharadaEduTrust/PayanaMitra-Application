export interface DocumentTypeOption {
  value: string;
  label: string;
}

export const DOCUMENT_TYPES: DocumentTypeOption[] = [
  { value: "aadhar", label: "Aadhar" },
  { value: "pan", label: "PAN" },
  { value: "passport", label: "Passport" },
  { value: "other", label: "Other" },
];

export function formatDocType(type?: string | null): string {
  if (!type) return "Document";
  const normalized = type.toLowerCase().trim();
  switch (normalized) {
    case "pan":
      return "PAN";
    case "aadhar":
    case "aadhaar":
      return "Aadhar";
    case "passport":
      return "Passport";
    case "visa":
      return "Visa";
    case "driving_licence":
    case "driving_license":
      return "Driving Licence";
    case "voter_id":
      return "Voter ID";
    case "other":
      return "Other";
    default:
      return normalized
        .replace(/_/g, " ")
        .split(" ")
        .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(" ");
  }
}

export function normalizeDocType(type?: string | null): string {
  if (!type) return "";
  const norm = type.toLowerCase().trim();
  if (norm === "aadhaar") return "aadhar";
  if (norm === "driving_license") return "driving_licence";
  return norm;
}

export function areDocTypesEqual(typeA?: string | null, typeB?: string | null): boolean {
  if (!typeA || !typeB) return false;
  return normalizeDocType(typeA) === normalizeDocType(typeB);
}
