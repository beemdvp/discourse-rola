import { Rola, type SignedChallenge } from "@radixdlt/rola";
import { ResultAsync } from "neverthrow";
import { corsHeaders } from "./utils";
import { secureRandom } from ".";
import { Challenges, RolaUser } from "./storage";
import {
  createDiscourseUser,
  getDiscourseEmailByUsername,
  getDiscourseUserById,
  getDiscourseUserByUsername,
  logoutUserById,
  storeUserCredentials,
} from "./api";
import { Op, type Model } from "sequelize";
import { decryptData, encryptData } from "./password-verify";

// A simple in-memory store for challenges. A database should be used in production.
const ChallengeStore = () => {
  const create = async () => {
    const challenge = secureRandom(32); // 32 random bytes as hex string
    const expires = Date.now() + 1000 * 60 * 2; // expires in 5 minutes

    await Challenges.destroy({
      where: { expiry: { [Op.lt]: Date.now() } },
    });

    await Challenges.build({ challenge, expiry: expires }).save();

    return challenge;
  };

  const verify = async (input: string) => {
    const challenge = await Challenges.findOne({
      where: { challenge: input },
    }).catch(() => null);

    if (!challenge) return false;

    await Challenges.destroy({
      where: { challenge: input },
    });

    const isValid =
      challenge instanceof Challenges &&
      challenge?.dataValues.expiry > Date.now(); // check if challenge has expired

    console.log("Challenge verified:", isValid);
    return isValid;
  };

  return { create, verify };
};

export const challengeStore = ChallengeStore();

const { verifySignedChallenge } = Rola({
  applicationName: process.env.APPLICATION_NAME!, // name of the dApp,
  dAppDefinitionAddress: process.env.DAPP_DEFINITION_ADDRESS!, // address of the dApp definition
  networkId: +(process.env.NETWORK_ID || 2), // network id of the Radix network
  expectedOrigin: process.env.ROLA_EXPECTED_ORIGIN!, // origin of the client making the wallet request
});

export async function isRequestAuthorized(
  request: Request,
  migrationAuth: { id: string; clientId: string; csrfToken: string },
) {
  return fetch(`${process.env.DISCOURSE_API_URL}/presence/update`, {
    headers: {
      accept: "*/*",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "discourse-logged-in": "true",
      "discourse-present": "true",
      "x-csrf-token": migrationAuth.csrfToken,
      "x-requested-with": "XMLHttpRequest",
      cookie: request.headers.get("cookie") || "",
    },
    body: `client_id=${migrationAuth.clientId}&present_channels%5B%5D=%2Fchat-user%2Fcore%2F${migrationAuth.id}`,
    method: "POST",
  })
    .then((r) => r.json())
    .then((r) => r[`/chat-user/core/${migrationAuth.id}`])
    .catch((e) => {
      console.log("verify migration failed ", e);
      return false;
    });
}

export const handleVerify = async (req: Request) => {
  const body = (await req.json()) as {
    proofs: SignedChallenge[];
    personaData: { fields: Record<string, string> | string[] }[];
    persona: { identity_address: string; label: string };
    migrationAuth?: {
      id: string;
      clientId: string;
      csrfToken: string;
      token: string;
    };
  };

  const challenges = [
    ...body.proofs
      .reduce((acc, curr) => acc.add(curr.challenge), new Set<string>())
      .values(),
  ];

  const isChallengeValid = (
    await Promise.all(
      challenges.map((challenge) => challengeStore.verify(challenge)),
    )
  ).some((v) => v);

  if (!isChallengeValid)
    return new Response(null, { status: 400, headers: { ...corsHeaders() } });

  const result = await ResultAsync.combine(
    body.proofs.map((signedChallenge) =>
      verifySignedChallenge(signedChallenge),
    ),
  );

  if (result.isErr()) {
    console.log("Error verifying challenges", result.error);
    return new Response(null, {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  if (body.migrationAuth) {
    const isMigrationAuthorized = await isRequestAuthorized(
      req,
      body.migrationAuth,
    );

    console.log("migration auth success");

    if (!isMigrationAuthorized) {
      return new Response(null, {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const user = await getDiscourseUserById({ id: body.migrationAuth.id });

    if (!user) {
      return new Response(null, {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const password = secureRandom(16);

    const username = body.persona.label.replace(/"/g, "");

    if (user.username != username) {
      return new Response(null, {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const [email] = body.personaData[0].fields as string[];

    const userFound = await RolaUser.findOne({
      attributes: ["password", "username"],
      where: { identity_address: body.proofs[0].address },
    });

    if (userFound instanceof RolaUser) {
      const { username, password } = userFound.dataValues;

      return new Response(
        JSON.stringify({
          valid: true,
          email,
          username,
          rolaPassword: decryptData(password),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        },
      );
    }

    const savedUser = await storeUserCredentials(
      body,
      username,
      encryptData(password),
    );

    if (!savedUser) {
      return new Response(null, {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    return new Response(
      JSON.stringify({
        valid: true,
        rolaPassword: password,
        username,
        email,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      },
    );
  }

  const userFound = await RolaUser.findOne({
    attributes: ["password", "username"],
    where: { identity_address: body.proofs[0].address },
  });

  const usernameAndPassword = await getOrCreateUser(body, userFound);

  if (!usernameAndPassword) {
    return new Response(null, {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  const { username, password } = usernameAndPassword;

  return new Response(
    JSON.stringify({
      valid: true,
      credentials: { username, password },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    },
  );
};

async function getOrCreateUser(
  body: {
    proofs: SignedChallenge[];
    personaData: { fields: Record<string, string> | string[] }[];
    persona: { identity_address: string; label: string };
  },
  userFound: Model<any, any> | null,
): Promise<{ username: string; password: string } | null | undefined> {
  const [email] = body.personaData[0].fields as string[];
  const username = body.persona.label.replace(/"/g, "");

  const [usernameValid, emailValid] = await Promise.allSettled([
    getDiscourseUserByUsername({ username }),
    getDiscourseEmailByUsername({ username }),
  ]);

  if (
    !userFound ||
    (usernameValid.status === "fulfilled" &&
      usernameValid.value?.error_type === "not_found" &&
      emailValid.status === "fulfilled" &&
      emailValid.value?.error_type === "not_found")
  ) {
    return await createNewUser({
      body,
      email,
      username,
      firstName: "",
      lastName: "",
    });
  } else {
    if (userFound instanceof RolaUser) {
      const { username, password } = userFound.dataValues;

      if (
        usernameValid.status === "rejected" ||
        emailValid.status === "rejected"
      ) {
        return null;
      }

      const validatedUser =
        usernameValid?.value?.user.username === username &&
        emailValid?.value?.email === email;

      return validatedUser
        ? { username, password: decryptData(password) }
        : null;
    }
    return null;
  }
}

export async function createNewUser({
  body,
  email,
  username,
  firstName,
  lastName,
}: {
  body: {
    proofs: SignedChallenge[];
    personaData: { fields: Record<string, string> | string[] }[];
  };
  email: string;
  username: string;
  firstName: string;
  lastName: string;
}) {
  const password = secureRandom(16);

  const createdUserResponse = await createDiscourseUser({
    email,
    username,
    firstName,
    lastName,
    password,
  });

  if (!createdUserResponse || !createdUserResponse.success) {
    return null;
  }

  const savedUser = await storeUserCredentials(
    body,
    username,
    encryptData(password),
  );

  if (!savedUser) {
    return null;
  }

  return { username, password };
}
