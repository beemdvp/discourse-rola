import { serve } from "bun";
import crypto from "node:crypto";
import { challengeStore, handleVerify } from "./verify";
import { corsHeaders } from "./utils";

export const secureRandom = (byteCount: number): string =>
  crypto.randomBytes(byteCount).toString("hex");

console.log("using rola config", {
  applicationName: process.env.APPLICATION_NAME!, // name of the dApp,
  dAppDefinitionAddress: process.env.DAPP_DEFINITION_ADDRESS!, // address of the dApp definition
  networkId: +(process.env.NETWORK_ID || 2), // network id of the Radix network
  expectedOrigin: process.env.ROLA_EXPECTED_ORIGIN!, // origin of the client making the wallet request
});

function handleCreateChallenge(): Response {
  return new Response(JSON.stringify({ challenge: challengeStore.create() }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

serve({
  port: 3003,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === "OPTIONS") {
      return new Response(undefined, { status: 204, headers: corsHeaders() });
    }

    if (path === "/create-challenge" && method === "GET") {
      return handleCreateChallenge();
    }

    if (path === "/verify" && method === "POST") {
      return await handleVerify(req);
    }

    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain", ...corsHeaders() },
    });
  },
});

console.log("Server running on port 3003");
