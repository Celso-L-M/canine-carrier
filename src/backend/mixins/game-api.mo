import Map "mo:core/Map";
import Types "../types/common";
import GameLib "../lib/game";

mixin (
  stats : Map.Map<Types.UserId, Types.PlayerStats>,
  settings : Map.Map<Types.UserId, Types.PlayerSettings>,
) {
  /// Return the caller's best score and total items collected.
  public query ({ caller }) func getMyStats() : async ?Types.PlayerStats {
    GameLib.getStats(stats, caller);
  };

  /// Record a finished run for the caller.
  public shared ({ caller }) func recordRun(score : Nat, itemsCollected : Nat) : async Types.PlayerStats {
    GameLib.recordRun(stats, caller, score, itemsCollected);
  };

  /// Return the caller's saved settings.
  public query ({ caller }) func getMySettings() : async ?Types.PlayerSettings {
    GameLib.getSettings(settings, caller);
  };

  /// Save the caller's settings.
  public shared ({ caller }) func saveMySettings(value : Types.PlayerSettings) : async Types.PlayerSettings {
    GameLib.saveSettings(settings, caller, value);
  };
};
