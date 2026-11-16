/**
 * Evidence policy shared by the Supabase Edge Function and the Node regression suite.
 * @param {{classification:string, confidence:number, evidence:Array<{source:string,quote:string}>, explanation:string, nextMove:string}} input
 * @returns {{classification:string,confidence:number,explanation:string,nextMove:string}}
 */
export function applyEvidencePolicy(input) {
  const hasAgreementEvidence = input.evidence.some((entry) => entry.source === "agreement");
  const hasClientMessageEvidence = input.evidence.some((entry) => entry.source === "client_message");
  const requiresAgreement = input.classification === "Likely included"
    || input.classification === "Likely additional"
    || input.classification === "Scope conflict";
  if (!input.evidence.length || !hasClientMessageEvidence
      || (requiresAgreement && !hasAgreementEvidence)) {
    const explanation = !input.evidence.length
      ? "No verifiable quotation from the supplied agreement or client message supports this assessment."
      : requiresAgreement && !hasAgreementEvidence
        ? "The proposed scope classification is not supported by a verifiable agreement quotation, so this item needs clarification."
        : "The request is not supported by a verifiable quotation from the client message, so this item needs clarification.";
    return {
      classification: "Clarify",
      confidence: Math.min(input.confidence, 0.35),
      explanation,
      nextMove: "Ask for the relevant agreed clause or clarify the request with the client before deciding its scope.",
    };
  }
  if (!input.explanation || !input.nextMove) {
    throw new Error("model_rationale_incomplete");
  }
  return {
    classification: input.classification,
    confidence: input.confidence,
    explanation: input.explanation,
    nextMove: input.nextMove,
  };
}

/** Normalize request descriptions for case/whitespace-insensitive duplicate detection. */
export function normalizeRequestIdentity(request) {
  return String(request ?? "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}
