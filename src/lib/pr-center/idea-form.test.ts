import { describe, expect, it, vi } from "vitest";
import { submitIdeaForm } from "./idea-form";

describe("submitIdeaForm", () => {
  it("keeps the draft intact and open when creation returns false", async () => {
    const draft = {
      title: "Road safety campaign",
      rationale: "Explain the campaign angle",
      audience: "Commuters",
      pillar: "Safety",
      channel: "Facebook",
      priority: "High",
      campaign: "Road safety",
      evidenceText: "https://example.org/source",
    };
    let currentDraft = { ...draft };
    let open = true;
    const onSaved = vi.fn(() => {
      currentDraft = {
        title: "",
        rationale: "",
        audience: "",
        pillar: "",
        channel: "",
        priority: "",
        campaign: "",
        evidenceText: "",
      };
      open = false;
    });

    const saved = await submitIdeaForm(async () => false, onSaved);

    expect(saved).toBe(false);
    expect(currentDraft).toEqual(draft);
    expect(open).toBe(true);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("clears and closes the draft only after creation succeeds", async () => {
    const draft = {
      title: "Road safety campaign",
      rationale: "Explain the campaign angle",
      audience: "Commuters",
      pillar: "Safety",
      channel: "Facebook",
      priority: "High",
      campaign: "Road safety",
      evidenceText: "https://example.org/source",
    };
    let currentDraft = { ...draft };
    let open = true;
    const onSaved = vi.fn(() => {
      currentDraft = {
        title: "",
        rationale: "",
        audience: "",
        pillar: "",
        channel: "",
        priority: "",
        campaign: "",
        evidenceText: "",
      };
      open = false;
    });

    const saved = await submitIdeaForm(async () => true, onSaved);

    expect(saved).toBe(true);
    expect(currentDraft).toEqual({
      title: "",
      rationale: "",
      audience: "",
      pillar: "",
      channel: "",
      priority: "",
      campaign: "",
      evidenceText: "",
    });
    expect(open).toBe(false);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("does not clear the draft when creation throws", async () => {
    const onSaved = vi.fn();

    await expect(
      submitIdeaForm(async () => {
        throw new Error("network error");
      }, onSaved),
    ).rejects.toThrow("network error");
    expect(onSaved).not.toHaveBeenCalled();
  });
});
