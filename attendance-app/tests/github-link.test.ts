import { expect, it, vi } from "vitest";
import {
  parseRepositoryUrl,
  verifyRepository,
} from "../lib/attendance/github-link";
it("accepts GitHub repository URLs and rejects non-GitHub hosts, credentials, query strings and paths", () => {
  expect(parseRepositoryUrl("https://github.com/arta/rideshare.git")).toEqual({
    owner: "arta",
    repo: "rideshare",
  });
  for (const value of [
    "https://github.com.evil.test/arta/repo",
    "http://github.com/arta/repo",
    "https://github.com@evil.test/a/b",
    "https://github.com/a/b/tree/main",
    "https://github.com/a/b?x=1",
    "https://github.com/a/b#readme",
  ])
    expect(() => parseRepositoryUrl(value)).toThrow();
});
it("verifies repository ownership by immutable account ID and rejects private/fork/other-owner repositories", async () => {
  const load = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        owner: { id: 777 },
        full_name: "Arta/RideShare",
        private: false,
        fork: false,
      }),
    });
  await expect(
    verifyRepository("https://github.com/arta/rideshare", "777", load),
  ).resolves.toBe("https://github.com/Arta/RideShare");
  for (const data of [
    { owner: { id: 888 } },
    { owner: { id: 777 }, private: true },
    { owner: { id: 777 }, fork: true },
  ]) {
    load.mockResolvedValue({ ok: true, json: async () => data });
    await expect(
      verifyRepository("https://github.com/arta/rideshare", "777", load),
    ).rejects.toThrow("repository_not_owned");
  }
});
