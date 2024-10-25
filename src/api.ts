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
      }>;
    })
    .catch(() => {
      return null;
    });
}
