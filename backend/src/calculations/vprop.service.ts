import { BadGatewayException, Injectable } from "@nestjs/common";
import type { PredictVpropDto } from "./dto/predict-vprop.dto";
import type { VpropPredictResponse } from "./types/vprop.types";
import { VpropClient } from "./vprop.client";

@Injectable()
export class VpropService {
  constructor(private readonly client: VpropClient) {}

  async predict(body: PredictVpropDto): Promise<VpropPredictResponse> {
    const response = await this.client.predict(body.smiles.trim());
    if (!this.isValidResponse(response)) {
      throw new BadGatewayException({ message: "VPROP_INVALID_RESPONSE" });
    }
    return response;
  }

  private isValidResponse(response: unknown): response is VpropPredictResponse {
    if (!response || typeof response !== "object") return false;
    const result = (response as Record<string, unknown>).result;
    if (!result || typeof result !== "object") return false;
    const value = result as Record<string, unknown>;
    return (
      typeof value.logP === "number" &&
      Number.isFinite(value.logP) &&
      Array.isArray(value.logDByPh) &&
      Boolean(value.info && typeof value.info === "object") &&
      Boolean(value.solubilities && typeof value.solubilities === "object") &&
      Boolean(value.distribution && typeof value.distribution === "object")
    );
  }
}
