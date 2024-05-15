import { BBNativeRollupProver, type BBProverConfig } from '@aztec/bb-prover';
import { PublicKernelType, mockTx } from '@aztec/circuit-types';
import { type Proof, makeEmptyProof } from '@aztec/circuits.js';
import { makePublicCallRequest } from '@aztec/circuits.js/testing';
import { createDebugLogger } from '@aztec/foundation/log';
import { type ServerProtocolArtifact } from '@aztec/noir-protocol-circuits-types';

import { TestContext } from '../mocks/test_context.js';

const logger = createDebugLogger('aztec:bb-prover-public-kernel');

describe('prover/bb_prover/public-kernel', () => {
  let context: TestContext;
  let prover: BBNativeRollupProver;

  beforeAll(async () => {
    const buildProver = async (bbConfig: BBProverConfig) => {
      bbConfig.circuitFilter = [
        'PublicKernelAppLogicArtifact',
        'PublicKernelSetupArtifact',
        'PublicKernelTailArtifact',
        'PublicKernelTeardownArtifact',
      ];
      prover = await BBNativeRollupProver.new(bbConfig);
      return prover;
    };
    context = await TestContext.new(logger, 1, buildProver);
  });

  afterAll(async () => {
    await context.cleanup();
  });

  it('proves the public kernel circuits', async () => {
    const teardown = makePublicCallRequest();
    const tx = mockTx(1000, {
      numberOfNonRevertiblePublicCallRequests: 1,
      numberOfRevertiblePublicCallRequests: 1,
      publicTeardownCallRequest: teardown,
    });
    tx.data.constants.historicalHeader = await context.actualDb.buildInitialHeader();

    const [processed, failed] = await context.processPublicFunctions([tx], 1, undefined);

    expect(processed.length).toBe(1);
    expect(failed.length).toBe(0);
    const processedTx = processed[0];
    expect(processedTx.publicKernelRequests.map(r => r.type)).toEqual([
      PublicKernelType.SETUP,
      PublicKernelType.APP_LOGIC,
      PublicKernelType.TEARDOWN,
      PublicKernelType.TAIL,
    ]);

    const getArtifactForPublicKernel = (type: PublicKernelType): ServerProtocolArtifact => {
      switch (type) {
        case PublicKernelType.NON_PUBLIC:
          throw new Error(`Can't prove non-public kernels`);
        case PublicKernelType.SETUP:
          return 'PublicKernelSetupArtifact';
        case PublicKernelType.APP_LOGIC:
          return 'PublicKernelAppLogicArtifact';
        case PublicKernelType.TEARDOWN:
          return 'PublicKernelTeardownArtifact';
        case PublicKernelType.TAIL:
          return 'PublicKernelTailArtifact';
      }
    };

    for (const request of processedTx.publicKernelRequests) {
      const artifact = getArtifactForPublicKernel(request.type);
      logger.verbose(`Proving kernel type: ${PublicKernelType[request.type]}`);
      let proof: Proof = makeEmptyProof();
      if (request.type === PublicKernelType.TAIL) {
        await expect(
          context.prover.getPublicTailProof(request).then(result => {
            proof = result.proof;
          }),
        ).resolves.not.toThrow();
      } else {
        await expect(
          context.prover.getPublicKernelProof(request).then(result => {
            proof = result.proof;
          }),
        ).resolves.not.toThrow();
      }

      logger.verbose(`Verifying kernel type: ${PublicKernelType[request.type]}`);
      await expect(prover.verifyProof(artifact, proof)).resolves.not.toThrow();
    }
  });
});