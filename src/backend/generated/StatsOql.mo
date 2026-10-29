import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Iter "mo:core/Iter";
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import RecordValue "mo:caffeineai-oql/RecordValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import NatValue "mo:caffeineai-oql/NatValue";
import Types "../types/common";

/// OQL entity for per-caller player stats, keyed by owner principal.
/// The owner lives in the Map key, so the row source is subject-honouring
/// (`newScoped`) and the owner column is promoted from the key.
module {
  /// Flat row shape: the owner promoted from the Map key plus the stats.
  public type Row = {
    owner : Principal;
    bestScore : Nat;
    totalItemsCollected : Nat;
  };

  public func entity(stats : Map.Map<Types.UserId, Types.PlayerStats>) : Entity.Decl {
    OQL.Entity.newScoped<Row>(
      "playerStats",
      func (subject : ?Principal) : Iter.Iter<Row> {
        switch (subject) {
          case (?p) {
            switch (stats.get(p)) {
              case (?s) { Iter.singleton({ owner = p; bestScore = s.bestScore; totalItemsCollected = s.totalItemsCollected }) };
              case null { Iter.empty() };
            };
          };
          case null {
            stats.entries().map(func ((owner, s)) = { owner; bestScore = s.bestScore; totalItemsCollected = s.totalItemsCollected });
          };
        };
      },
      "PlayerStats",
      "owner",
    )
      .sample({ owner = Principal.fromText("aaaaa-aa"); bestScore = 0; totalItemsCollected = 0 })
      .ownedBy("owner")
      .scopedPerUser()
      .build();
  };
};
