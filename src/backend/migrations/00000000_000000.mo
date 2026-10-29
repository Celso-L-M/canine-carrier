import AccessControl "mo:caffeineai-authorization/access-control";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  public type OldActor = {};

  // Inlined stable types (migrations must be self-contained).
  public type UserId = Principal;
  public type ControlScheme = { #wasd; #arrows };
  public type PlayerStats = {
    bestScore : Nat;
    totalItemsCollected : Nat;
  };
  public type PlayerSettings = {
    controlScheme : ControlScheme;
    soundEnabled : Bool;
  };

  public type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    stats : Map.Map<UserId, PlayerStats>;
    settings : Map.Map<UserId, PlayerSettings>;
  };

  public func migration(_ : OldActor) : NewActor {
    {
      accessControlState = AccessControl.initState();
      stats = Map.empty();
      settings = Map.empty();
    };
  };
};
