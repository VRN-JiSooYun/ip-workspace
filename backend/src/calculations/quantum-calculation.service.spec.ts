import { ThreeDPsaCallbackDto } from './dto/three-d-psa-callback.dto';
import { QuantumCalculationService } from './quantum-calculation.service';

describe('QuantumCalculationService callback', () => {
  const callbackBody: ThreeDPsaCallbackDto = {
    job_id: '123',
    unique_key: 'workspace-550e8400-e29b-41d4-a716-446655440000',
    status: 'completed',
    result_data: '72.41',
    job_type: 'PSA',
  };

  const createService = (job: { id: string; status: string }) => {
    const findFirst = jest.fn().mockResolvedValue(job);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new QuantumCalculationService(
      {
        client: {
          calculationJob: { findFirst, updateMany },
        },
      } as never,
      {} as never,
      {
        get: (_key: string, fallback: unknown) => fallback,
      } as never,
    );

    return { service, findFirst, updateMany };
  };

  it('stores a completed callback without authentication parameters', async () => {
    const { service, findFirst, updateMany } = createService({
      id: 'job-id',
      status: 'QUEUED',
    });

    await expect(service.receiveCallback(callbackBody)).resolves.toEqual({
      result_code: '0000',
      result: 'OK',
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        externalKey: callbackBody.unique_key,
        jobType: 'PSA',
        deletedAt: null,
      },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'job-id', status: { not: 'COMPLETED' } },
      data: {
        status: 'COMPLETED',
        externalJobId: '123',
        callbackReceivedAt: expect.any(Date),
        completedAt: expect.any(Date),
        resultData: { value: 72.41 },
        errorMessage: null,
      },
    });
  });

  it('does not regress a completed job after a late failed callback', async () => {
    const { service, updateMany } = createService({
      id: 'job-id',
      status: 'COMPLETED',
    });

    await expect(
      service.receiveCallback({
        ...callbackBody,
        status: 'failed',
        result_data: undefined,
        error_message: 'late failure',
      }),
    ).resolves.toEqual({ result_code: '0000', result: 'OK' });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
