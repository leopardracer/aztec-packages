// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.27;

import {IPayload} from "@aztec/governance/interfaces/IPayload.sol";
import {ApellaBase} from "./base.t.sol";
import {IApella} from "@aztec/governance/interfaces/IApella.sol";
import {IERC20Errors} from "@oz/interfaces/draft-IERC6093.sol";
import {Timestamp} from "@aztec/core/libraries/TimeMath.sol";
import {Errors} from "@aztec/governance/libraries/Errors.sol";
import {DataStructures} from "@aztec/governance/libraries/DataStructures.sol";
import {ConfigurationLib} from "@aztec/governance/libraries/ConfigurationLib.sol";

contract ProposeTest is ApellaBase {
  function test_WhenCallerIsNotGerousia() external {
    // it revert
    vm.expectRevert(
      abi.encodeWithSelector(
        Errors.Apella__CallerNotGerousia.selector, address(this), address(gerousia)
      )
    );
    apella.propose(IPayload(address(0)));
  }

  function test_WhenCallerIsGerousia(address _proposal) external {
    // it creates a new proposal with current config
    // it emits a {ProposalCreated} event
    // it returns true

    DataStructures.Configuration memory config = apella.getConfiguration();

    proposalId = apella.proposalCount();

    vm.expectEmit(true, true, true, true, address(apella));
    emit IApella.Proposed(proposalId, _proposal);

    vm.prank(address(gerousia));
    assertTrue(apella.propose(IPayload(_proposal)));

    DataStructures.Proposal memory proposal = apella.getProposal(proposalId);
    assertEq(proposal.config.executionDelay, config.executionDelay);
    assertEq(proposal.config.gracePeriod, config.gracePeriod);
    assertEq(proposal.config.minimumVotes, config.minimumVotes);
    assertEq(proposal.config.quorum, config.quorum);
    assertEq(proposal.config.voteDifferential, config.voteDifferential);
    assertEq(proposal.config.votingDelay, config.votingDelay);
    assertEq(proposal.config.votingDuration, config.votingDuration);
    assertEq(proposal.creation, Timestamp.wrap(block.timestamp));
    assertEq(proposal.creator, address(gerousia));
    assertEq(proposal.summedBallot.nea, 0);
    assertEq(proposal.summedBallot.yea, 0);
    assertTrue(proposal.state == DataStructures.ProposalState.Pending);
  }
}
