import { RequestedQuantumJobType } from "./dto/create-quantum-calculation.dto";
import { ThreeDPsaClient } from "./three-d-psa.client";

describe("ThreeDPsaClient", () => {
  it("submits the job callback URL with the calculation request", async () => {
    const post = jest.fn((url: string, body: string) => {
      void url;
      void body;
      return Promise.resolve({
        data: { result_code: "0000", result: "OK" },
      });
    });
    const configValues: Record<string, unknown> = {
      "threeDPsa.apiUrl": "http://172.16.1.130:20010",
      "threeDPsa.callbackUrl":
        "http://172.16.1.183:18082/api/calculations/3d-psa/callback",
      "threeDPsa.submitTimeoutMs": 10000,
    };
    const client = new ThreeDPsaClient(
      { axiosRef: { post } } as never,
      {
        get: (key: string, fallback: unknown) => configValues[key] ?? fallback,
      } as never,
    );

    await client.submit({
      externalKey: "workspace-550e8400-e29b-41d4-a716-446655440000",
      smiles: "CCO",
      jobType: RequestedQuantumJobType.PSA,
    });

    expect(post).toHaveBeenCalledTimes(1);
    const submittedBody = new URLSearchParams(post.mock.calls[0][1]);
    expect(submittedBody.get("unique_key")).toBe(
      "workspace-550e8400-e29b-41d4-a716-446655440000",
    );
    expect(submittedBody.get("callback_url")).toBe(
      "http://172.16.1.183:18082/api/calculations/3d-psa/callback",
    );
  });
});
