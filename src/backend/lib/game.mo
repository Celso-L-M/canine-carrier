import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Types "../types/common";

module {
  /// Read the caller's stats, if any have been recorded.
  public func getStats(stats : Map.Map<Types.UserId, Types.PlayerStats>, caller : Principal) : ?Types.PlayerStats {
    stats.get(caller);
  };

  /// Record a completed run: keep the higher score and add collected items.
  public func recordRun(
    stats : Map.Map<Types.UserId, Types.PlayerStats>,
    caller : Principal,
    score : Nat,
    itemsCollected : Nat,
  ) : Types.PlayerStats {
    let previous = stats.get(caller);
    let bestScore = switch (previous) {
      case (?p) { if (score > p.bestScore) { score } else { p.bestScore } };
      case null { score };
    };
    let totalItemsCollected = switch (previous) {
      case (?p) { p.totalItemsCollected + itemsCollected };
      case null { itemsCollected };
    };
    let updated : Types.PlayerStats = { bestScore; totalItemsCollected };
    stats.add(caller, updated);
    updated;
  };

  /// Read the caller's settings, if any have been saved.
  public func getSettings(settings : Map.Map<Types.UserId, Types.PlayerSettings>, caller : Principal) : ?Types.PlayerSettings {
    settings.get(caller);
  };

  /// Save the caller's settings.
  public func saveSettings(
    settings : Map.Map<Types.UserId, Types.PlayerSettings>,
    caller : Principal,
    value : Types.PlayerSettings,
  ) : Types.PlayerSettings {
    settings.add(caller, value);
    value;
  };
};
