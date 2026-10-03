import { describe, expect, it } from "vitest";
import { classifyNotification, prefixedTitle } from "./notification-policy";

describe("classifyNotification", () => {
  it("classifies DUE notifications from title prefix", () => {
    expect(classifyNotification("[DUE] Task due soon: My Task")).toBe("DUE");
  });

  it("classifies OVERDUE notifications from title prefix", () => {
    expect(classifyNotification("[OVERDUE] Task overdue: My Task")).toBe("OVERDUE");
  });

  it("classifies MANDATORY notifications from title prefix", () => {
    expect(classifyNotification("[MANDATORY] Pending approval: My Task")).toBe(
      "MANDATORY",
    );
  });

  it("classifies CHANGE notifications from title prefix", () => {
    expect(
      classifyNotification("[CHANGE] Due date changed from 2026-10-01 to 2026-10-05"),
    ).toBe("CHANGE");
  });

  it("classifies ASSIGNMENT notifications from title prefix", () => {
    expect(classifyNotification("[ASSIGNMENT] PR Center task assigned")).toBe(
      "ASSIGNMENT",
    );
  });

  it("classifies STATUS notifications from title prefix", () => {
    expect(classifyNotification("[STATUS] Task transitioned")).toBe("STATUS");
  });

  it("classifies legacy 'assigned' titles as ASSIGNMENT", () => {
    expect(classifyNotification("PR Center task assigned")).toBe("ASSIGNMENT");
  });

  it("classifies legacy 'Approval needed' as STATUS", () => {
    expect(classifyNotification("Approval needed for review")).toBe("STATUS");
  });

  it("classifies empty titles as GENERAL", () => {
    expect(classifyNotification("Hello world")).toBe("GENERAL");
  });

  it("handles case insensitivity", () => {
    expect(classifyNotification("[due] lowercase test")).toBe("DUE");
  });
});

describe("prefixedTitle", () => {
  it("creates correct prefixed title for each category", () => {
    expect(prefixedTitle("DUE", "Task due soon")).toBe("[DUE] Task due soon");
    expect(prefixedTitle("OVERDUE", "Task overdue")).toBe("[OVERDUE] Task overdue");
    expect(prefixedTitle("MANDATORY", "Pending approval")).toBe(
      "[MANDATORY] Pending approval",
    );
    expect(prefixedTitle("CHANGE", "Due date changed")).toBe("[CHANGE] Due date changed");
    expect(prefixedTitle("ASSIGNMENT", "Task assigned")).toBe(
      "[ASSIGNMENT] Task assigned",
    );
  });
});
