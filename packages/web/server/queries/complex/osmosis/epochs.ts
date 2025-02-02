import { CoinPretty, Int } from "@keplr-wallet/unit";
import cachified, { CacheEntry } from "cachified";
import { LRUCache } from "lru-cache";

import { DEFAULT_LRU_OPTIONS } from "~/config/cache";
import { getAsset } from "~/server/queries/complex/assets";
import { queryEpochs } from "~/server/queries/osmosis/epochs";
import {
  queryEpochProvisions,
  queryOsmosisMintParams,
} from "~/server/queries/osmosis/mint";

const epochsCache = new LRUCache<string, CacheEntry>(DEFAULT_LRU_OPTIONS);

export function getEpochs() {
  return cachified({
    cache: epochsCache,
    key: "epochs",
    // 30 seconds
    ttl: 30 * 1000,
    getFreshValue: async () => {
      const { epochs } = await queryEpochs();
      return epochs;
    },
  });
}

export async function getEpochProvisions(): Promise<CoinPretty | undefined> {
  return cachified({
    cache: epochsCache,
    key: "epoch-provisions",
    ttl: 30 * 1000,
    getFreshValue: async () => {
      const [mintParams, provisionsResponse] = await Promise.all([
        queryOsmosisMintParams(),
        queryEpochProvisions(),
      ]);

      if (!provisionsResponse || !mintParams.params.mint_denom) {
        return;
      }

      const mintCurrency = await getAsset({
        anyDenom: mintParams.params.mint_denom,
      });

      if (!mintCurrency) {
        throw new Error("Unknown currency");
      }

      let provision = provisionsResponse.epoch_provisions;
      if (provision.includes(".")) {
        provision = provision.slice(0, provision.indexOf("."));
      }
      return new CoinPretty(mintCurrency, new Int(provision));
    },
  });
}

export async function getEpoch({ identifier }: { identifier: string }) {
  const epochs = await getEpochs();

  const epoch = epochs.find((epoch) => epoch.identifier === identifier);
  if (!epoch) {
    throw new Error(`Epoch ${identifier} not found`);
  }

  const duration = parseInt(epoch.duration.replace("s", ""));

  return {
    duration,
  };
}
