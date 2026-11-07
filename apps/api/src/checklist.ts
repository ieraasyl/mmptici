import type { Checklist } from "@app/contracts";

export const defaultChecklist: Checklist = {
  id: "00000000-0000-4000-8000-000000000001",
  revision: 1,
  name: "Chat quality checklist",
  criteria: [
    {
      id: "opening",
      title: "Opening the conversation",
      section: "Opening and understanding",
      guidance:
        "Yes if the operator greets the customer in the customer's language and introduces themselves in the first reply. Both are required.",
      weight: 10,
      kind: "binary",
      scale: [],
      allowNA: false,
    },
    {
      id: "understanding",
      title: "Understanding the customer's needs",
      section: "Opening and understanding",
      guidance:
        "Yes if the operator uses the available details and clarifies missing information before answering. Use N/A if there was enough information to answer from the start.",
      weight: 15,
      kind: "binary",
      scale: [],
      allowNA: true,
    },
    {
      id: "verification",
      title: "Identity verification",
      section: "Security and resolution",
      guidance:
        "Yes if identity verification was confirmed before the operator disclosed data or took a protected action. Use N/A for requests that require no verification, such as a general question about fees. If verification was required and the transcript does not confirm it, answer No.",
      weight: 20,
      kind: "binary",
      scale: [],
      allowNA: true,
    },
    {
      id: "guidance",
      title: "Correct and complete guidance",
      section: "Security and resolution",
      guidance:
        "20: addressed every material question or gave the correct next step. 15: resolved the main issue and missed a minor detail. 10: addressed part of the request and left a material question unanswered. 5: gave general guidance without a usable next step. 0: no substantive answer or an incorrect key recommendation. Use N/A if the conversation ended before the customer stated the request.",
      weight: 20,
      kind: "numeric",
      scale: [0, 5, 10, 15, 20],
      allowNA: true,
    },
    {
      id: "empathy",
      title: "Empathy and customer focus",
      section: "Managing and closing",
      guidance:
        "Yes if the operator was polite and, when the customer expressed dissatisfaction or described an inconvenience, responded to that specific issue.",
      weight: 15,
      kind: "binary",
      scale: [],
      allowNA: false,
    },
    {
      id: "management",
      title: "Conversation management, response speed, and language quality",
      section: "Managing and closing",
      guidance:
        "10: clear, coherent replies and the customer was told about any obvious wait. 7: one noticeable lapse but the customer could still understand and continue. 4: the customer had to ask again because of wording or the order of replies. 0: disjointed or contradictory replies made the flow unclear. Judge communication separately from whether the request was resolved. Do not apply a three-minute first-response threshold.",
      weight: 15,
      kind: "numeric",
      scale: [0, 4, 7, 10],
      allowNA: false,
    },
    {
      id: "closing",
      title: "Closing the conversation",
      section: "Managing and closing",
      guidance:
        "Yes if the operator says goodbye and either summarizes the outcome or offers further help. Use N/A if the conversation was cut off before the operator had a chance to close it.",
      weight: 5,
      kind: "binary",
      scale: [],
      allowNA: true,
    },
    {
      id: "violations",
      title: "Serious violations",
      section: "Serious violations",
      guidance:
        "Yes if the operator insulted the customer, offered paid services outside the company, or disclosed confidential information. An offer alone qualifies, such as asking for a personal phone number to provide paid advice or for funds to be sent to the operator personally.",
      weight: 0,
      kind: "flag",
      scale: [],
      allowNA: false,
    },
  ],
};
