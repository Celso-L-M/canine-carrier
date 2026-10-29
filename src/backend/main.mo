import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import Expose "mo:caffeineai-oql/Expose";
import Map "mo:core/Map";
import Types "types/common";
import GameApi "mixins/game-api";
import ApiDocMixin "mixins/api-doc";
import StatsOql "generated/StatsOql";
import SettingsOql "generated/SettingsOql";

actor {
  let accessControlState : AccessControl.AccessControlState;
  include MixinAuthorization(accessControlState, null);

  let stats : Map.Map<Types.UserId, Types.PlayerStats>;
  let settings : Map.Map<Types.UserId, Types.PlayerSettings>;

  include GameApi(stats, settings);

  include ApiDocMixin();

  include Expose({
    entities = [
      StatsOql.entity(stats),
      SettingsOql.entity(settings),
    ];
  });
};
