import { useCompanionStore } from "../companion-store";

describe("Companion Zustand Store", () => {
  beforeEach(() => {
    useCompanionStore.getState().resetForTesting();
  });

  it("has initial default state without exposing client api keys", () => {
    const state = useCompanionStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.isMinimized).toBe(false);
    expect(state.pose).toBe("greeting");
    expect(state.messages.length).toBeGreaterThan(0);
    expect(state.backendStatus).toBeDefined();
    expect(state.backendStatus.status).toBe("local");
  });

  it("toggles dialog open and close", () => {
    useCompanionStore.getState().openChat();
    expect(useCompanionStore.getState().isOpen).toBe(true);

    useCompanionStore.getState().closeChat();
    expect(useCompanionStore.getState().isOpen).toBe(false);
  });

  it("toggles minimize mode", () => {
    useCompanionStore.getState().toggleMinimize();
    expect(useCompanionStore.getState().isMinimized).toBe(true);

    useCompanionStore.getState().toggleMinimize();
    expect(useCompanionStore.getState().isMinimized).toBe(false);
  });

  it("updates pose and adds messages", () => {
    useCompanionStore.getState().setPose("document");
    expect(useCompanionStore.getState().pose).toBe("document");

    useCompanionStore.getState().addMessage({
      id: "msg-1",
      role: "user",
      content: "Halo El",
      timestamp: Date.now(),
    });

    expect(useCompanionStore.getState().messages.length).toBe(2);
    expect(useCompanionStore.getState().messages[1].content).toBe("Halo El");
  });

  it("updates backend status when set", () => {
    useCompanionStore.getState().setBackendStatus({
      configured: true,
      model: "gpt-4o-mini",
      provider: "9router",
      status: "online",
      active: true,
    });
    expect(useCompanionStore.getState().backendStatus.configured).toBe(true);
    expect(useCompanionStore.getState().backendStatus.status).toBe("online");
  });
});
