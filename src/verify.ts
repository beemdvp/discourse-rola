import { Rola, type SignedChallenge } from "@radixdlt/rola";
import { ResultAsync } from "neverthrow";
import { corsHeaders } from "./utils";
import { secureRandom } from ".";
import { Challenges, RolaUser } from "./storage";
import {
  createDiscourseUser,
  getDiscourseEmailByUsername,
  getDiscourseUserByUsername,
} from "./api";
import { Op, type Model } from "sequelize";

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

export const handleVerify = async (req: Request) => {
  const body = (await req.json()) as {
    proofs: SignedChallenge[];
    personaData: { fields: Record<string, string> | string[] }[];
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
    return new Response(null, {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
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
  },
  userFound: Model<any, any> | null,
): Promise<{ username: string; password: string } | null | undefined> {
  const {
    nickname: username,
    givenNames: firstName,
    familyName: lastName,
  } = body.personaData[0].fields as {
    nickname: string;
    givenNames: string;
    familyName: string;
  };

  const [email] = body.personaData[1].fields as string[];

  if (!userFound) {
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

    const user = RolaUser.build({
      identity_address: body.proofs[0].address,
      username,
      password,
    });

    const savedUser = await user.save().catch(() => null);

    if (!savedUser) {
      return null;
    }

    return { username, password };
  } else {
    if (userFound instanceof RolaUser) {
      const { username, password } = userFound.dataValues;

      const [usernameValid, emailValid] = await Promise.allSettled([
        getDiscourseUserByUsername({ username }),
        getDiscourseEmailByUsername({ username }),
      ]);

      if (
        usernameValid.status === "rejected" ||
        emailValid.status === "rejected"
      ) {
        return null;
      }

      const validatedUser =
        usernameValid?.value?.user.username === username &&
        emailValid?.value?.email === email;

      return validatedUser ? { username, password } : null;
    }
    return null;
  }
}
