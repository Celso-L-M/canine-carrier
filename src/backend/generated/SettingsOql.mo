import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Iter "mo:core/Iter";
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import RecordValue "mo:caffeineai-oql/RecordValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import TextValue "mo:caffeineai-oql/TextValue";
import BoolValue "mo:caffeineai-oql/BoolValue";
import Types "../types/common";

/// OQL entity for per-caller settings, keyed by owner principal.
/// The owner lives in the Map key, so the row source is subject-honouring
/// (`newScoped`) and the owner column is promoted from the key. The
/// control-scheme variant is rendered as its tag text.
module {
  /// Flat row shape: the owner promoted from the Map key plus the settings.
  public type Row = {
    owner : Principal;
    controlScheme : Text;
    soundEnabled : Bool;
  };

  func toRow(owner : Principal, s : Types.PlayerSettings) : Row = {
    owner;
    controlScheme = switch (s.controlScheme) { case (#wasd) "wasd"; case (#arrows) "arrows" };
    soundEnabled = s.soundEnabled;
  };

  public func entity(settings : Map.Map<Types.UserId, Types.PlayerSettings>) : Entity.Decl {
    OQL.Entity.newScoped<Row>(
      "playerSettings",
      func (subject : ?Principal) : Iter.Iter<Row> {
        switch (subject) {
          case (?p) {
            switch (settings.get(p)) {
              case (?s) { Iter.singleton(toRow(p, s)) };
              case null { Iter.empty() };
            };
          };
          case null {
            settings.entries().map(func ((owner, s)) = toRow(owner, s));
          };
        };
      },
      "PlayerSettings",
      "owner",
    )
      .sample({ owner = Principal.fromText("aaaaa-aa"); controlScheme = "wasd"; soundEnabled = true })
      .ownedBy("owner")
      .scopedPerUser()
      .build();
  };
};
