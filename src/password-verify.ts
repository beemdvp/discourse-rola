import { secureRandom } from ".";
import { passwordRequestRequest } from "./api";
import { corsHeaders } from "./utils";
import { isRequestAuthorized } from "./verify";
import crypto from "crypto";

export async function handlePasswordReset(req: Request): Promise<Response> {
  const bodyJson = await req.json();

  const isAuthorized = await isRequestAuthorized(req, bodyJson.migrationAuth);

  if (!isAuthorized) {
    return new Response(null, {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  const passwordResetResponse = await passwordRequestRequest({
    login: bodyJson.login,
  });

  if (
    !passwordRequestRequest ||
    !passwordResetResponse?.success ||
    !passwordResetResponse.user_found ||
    passwordResetResponse.errors
  ) {
    console.log("failed to reset password for login: ", passwordResetResponse);
    return new Response(null, {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  return new Response(
    JSON.stringify({ message: "Password reset request received." }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    },
  );
}

const encryptionMethod = "aes-256-ecb"; // Define the encryption method

// Retrieve the secret key from environment variables
const secretKey = process.env.SECRET_KEY || "default_secret_key";

// Generate a 32-byte key
const key = crypto
  .createHash("sha256")
  .update(secretKey)
  .digest("base64")
  .substring(0, 32);

// Encrypt data
export function encryptData(data: string): string {
  const cipher = crypto.createCipheriv(encryptionMethod, key, null); // ECB mode does not use an IV
  const encrypted = Buffer.concat([
    new Uint8Array(cipher.update(data, "utf8")),
    new Uint8Array(cipher.final()),
  ]);
  return encrypted.toString("hex");
}

// Decrypt data
export function decryptData(encryptedData: string): string {
  const decipher = crypto.createDecipheriv(encryptionMethod, key, null); // ECB mode does not use an IV
  const decrypted = Buffer.concat([
    new Uint8Array(
      decipher.update(new Uint8Array(Buffer.from(encryptedData, "hex"))),
    ),
    new Uint8Array(decipher.final()),
  ]);
  return decrypted.toString("utf8");
}
