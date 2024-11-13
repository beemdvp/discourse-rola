import type { SignedChallenge } from "@radixdlt/rola";
import { RolaUser } from "./storage";

export async function createDiscourseUser({
  email,
  username,
  firstName,
  lastName,
  password,
}: {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}) {
  return fetch(`${process.env.DISCOURSE_API_URL}/users.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": process.env.DISCOURSE_API_KEY!,
      "Api-Username": process.env.DISCOURSE_USERNAME!,
    },
    body: JSON.stringify({
      name: `${firstName} ${lastName}`,
      email,
      password,
      username,
      active: true,
      approved: true,
    }),
  })
    .then((r) => {
      return r.json() as Promise<{
        success: boolean;
        active: boolean;
        message: string;
        user_id: string;
      }>;
    })
    .catch((e) => {
      console.log(e);
      return null;
    });
}

export async function getDiscourseUserByUsername({
  username,
}: {
  username: string;
}) {
  return fetch(`${process.env.DISCOURSE_API_URL}/u/${username}.json`, {
    method: "GET",
    headers: {
      "Api-Key": process.env.DISCOURSE_API_KEY!,
      "Api-Username": process.env.DISCOURSE_USERNAME!,
    },
  })
    .then((r) => {
      return r.json() as Promise<{
        user_badges: unknown[];
        user: Record<string, unknown>;
        errors?: string[];
        error_type: string;
      }>;
    })
    .catch(() => {
      return null;
    });
}

export async function getDiscourseEmailByUsername({
  username,
}: {
  username: string;
}) {
  return fetch(`${process.env.DISCOURSE_API_URL}/u/${username}/emails.json`, {
    method: "GET",
    headers: {
      "Api-Key": process.env.DISCOURSE_API_KEY!,
      "Api-Username": process.env.DISCOURSE_USERNAME!,
    },
  })
    .then((r) => {
      return r.json() as Promise<{
        email: string;
        errors?: string[];
        error_type: string;
      }>;
    })
    .catch(() => {
      return null;
    });
}

export async function getDiscourseUserById({ id }: { id: string }) {
  return fetch(`${process.env.DISCOURSE_API_URL}/admin/users/${id}.json`, {
    method: "GET",
    headers: {
      "Api-Key": process.env.DISCOURSE_API_KEY!,
      "Api-Username": process.env.DISCOURSE_USERNAME!,
    },
  })
    .then((r) => {
      return r.json() as Promise<{
        username: string;
      }>;
    })
    .catch((e) => {
      console.log("get user by id error", e);
      return null;
    });
}

export async function logoutUserById({
  id,
  username,
}: {
  id: string;
  username: string;
}) {
  return fetch(
    `${process.env.DISCOURSE_API_URL}/admin/users/${id}/log_out.json`,
    {
      method: "POST",
      headers: {
        "Api-Key": process.env.DISCOURSE_API_KEY!,
        "Api-Username": process.env.DISCOURSE_USERNAME!,
      },
      body: JSON.stringify({ email_or_username: username }),
    },
  )
    .then((r) => {
      return r.json() as Promise<{
        success: boolean;
      }>;
    })
    .catch((e) => {
      console.log("log out user by id error", e);
      return null;
    });
}

export async function updateDiscourseUserPassword({
  token,
  username,
  password,
}: {
  token: string;
  username: string;
  password: string;
}) {
  return fetch(
    `${process.env.DISCOURSE_API_URL}/users/password-reset/${token}.json`,
    {
      method: "POST",
      headers: {
        "Api-Key": process.env.DISCOURSE_API_KEY!,
        "Api-Username": process.env.DISCOURSE_USERNAME!,
      },
      body: JSON.stringify({
        username,
        password,
      }),
    },
  )
    .then((r) => {
      console.log(r);
      return r.json() as Promise<{
        email: string;
      }>;
    })
    .catch((e) => {
      console.log("update password error", e);
      return null;
    });
}

export async function passwordRequestRequest({ login }: { login: string }) {
  return fetch(
    `${process.env.DISCOURSE_API_URL}/session/forgot_password.json`,
    {
      method: "POST",
      headers: {
        "Api-Key": process.env.DISCOURSE_API_KEY!,
        "Api-Username": process.env.DISCOURSE_USERNAME!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login,
      }),
    },
  )
    .then((r) => {
      return r.json() as Promise<{
        success: string;
        user_found: boolean;
        errors?: string[];
      }>;
    })
    .catch((e) => {
      console.log("password reset error", e);
      return null;
    });
}

export async function deleteDiscourseUser({ id }: { id: string }) {
  return fetch(`${process.env.DISCOURSE_API_URL}/admin/users/${id}.json`, {
    method: "DELETE",
    headers: {
      "Api-Key": process.env.DISCOURSE_API_KEY!,
      "Api-Username": process.env.DISCOURSE_USERNAME!,
    },
    body: JSON.stringify({
      delete_pots: false,
      block_email: false,
      block_urls: false,
      block_ip: false,
    }),
  })
    .then((r) => {
      return r.json() as Promise<{
        email: string;
      }>;
    })
    .catch((e) => {
      console.log("delete user error", e);
      return null;
    });
}

export async function storeUserCredentials(
  body: {
    proofs: SignedChallenge[];
    personaData: { fields: Record<string, string> | string[] }[];
  },
  username: string,
  password: string,
) {
  const user = RolaUser.build({
    identity_address: body.proofs[0].address,
    username,
    password,
  });

  const savedUser = await user.save().catch(() => null);
  return savedUser;
}
