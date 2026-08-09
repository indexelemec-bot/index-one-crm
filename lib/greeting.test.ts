import { describe, expect, it } from "vitest";
import { greetingForHour } from "@/lib/greeting";

describe("saludo según la hora local", () => {
  it.each([
    [5, "Buenos días"], [11, "Buenos días"],
    [12, "Buenas tardes"], [18, "Buenas tardes"],
    [19, "Buenas noches"], [23, "Buenas noches"], [0, "Buenas noches"], [4, "Buenas noches"]
  ])("a las %i horas muestra %s", (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});
