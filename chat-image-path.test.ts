import { describe, expect, it } from "vitest";

import { fileUriToAbsolutePath } from "./chat-image-path";

describe("fileUriToAbsolutePath", () => {
  it("decodes a file URI into an absolute local path", () => {
    expect(fileUriToAbsolutePath("file:///data/user/0/echoai/chat-images/my%20photo.jpg"))
      .toBe("/data/user/0/echoai/chat-images/my photo.jpg");
  });

  it("rejects content URIs and non-absolute file URIs", () => {
    expect(fileUriToAbsolutePath("content://media/images/12")).toBeNull();
    expect(fileUriToAbsolutePath("file://relative/path.jpg")).toBeNull();
  });
});
