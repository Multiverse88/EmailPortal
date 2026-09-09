import { getTypingDelay } from "../typewriter";

describe("Typewriter Helper Functions", () => {
  it("calculates appropriate pause delays for punctuation marks", () => {
    expect(getTypingDelay(".", 18)).toBe(240);
    expect(getTypingDelay("!", 18)).toBe(240);
    expect(getTypingDelay("?", 18)).toBe(240);
    expect(getTypingDelay(",", 18)).toBe(110);
    expect(getTypingDelay(";", 18)).toBe(110);
    expect(getTypingDelay("\n", 18)).toBe(180);
  });

  it("defaults to base speed for regular alphanumeric characters", () => {
    expect(getTypingDelay("a", 18)).toBe(18);
    expect(getTypingDelay("Z", 15)).toBe(15);
    expect(getTypingDelay(" ", 20)).toBe(20);
  });
});
