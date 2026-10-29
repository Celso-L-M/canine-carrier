import Principal "mo:core/Principal";

module {
  /// Caller identity key for per-user records.
  public type UserId = Principal;

  /// Preferred control scheme for Max.
  public type ControlScheme = {
    #wasd;
    #arrows;
  };

  /// Per-caller game progress: best score and total lost items collected.
  public type PlayerStats = {
    bestScore : Nat;
    totalItemsCollected : Nat;
  };

  /// Per-caller game settings.
  public type PlayerSettings = {
    controlScheme : ControlScheme;
    soundEnabled : Bool;
  };
};
