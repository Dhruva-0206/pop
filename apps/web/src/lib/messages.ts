import { APP_NAME } from "@pop/shared";

/** Message a seller signs to open the dashboard. Signing moves no money. */
export const sellerLoginMessage = (address: string, issuedAt: string) =>
  `${APP_NAME} seller dashboard sign-in\nAddress: ${address}\nIssued: ${issuedAt}\nThis signature only proves you control the wallet. It moves no money.`;
