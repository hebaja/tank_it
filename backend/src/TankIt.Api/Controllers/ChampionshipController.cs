using Microsoft.AspNetCore.Mvc;

namespace TankIt.Api.Controllers;

/// <summary>
/// Championship (FT-N) lifecycle — see docs/GDD.md §6 and docs/database-schema.md
/// "Championship mode (FT-N)" for the full rules. Not implemented yet; this stub
/// documents the endpoint shape and the algorithm each one is responsible for.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ChampionshipController : ControllerBase
{
    // POST /api/championships
    //   Body: { playerCount: 2|3|4, participants: [{ userId | isAi, tankColor }] }
    //   Creates a Championship (status=pending) + ChampionshipParticipants.
    //   TargetScore is set from playerCount: 2->5, 3->7, 4->10 (docs/GDD.md §6).

    // POST /api/championships/{id}/matches
    //   Starts the next Match in the series: creates a Match row with
    //   ChampionshipId = {id}, SequenceNumber = (previous max + 1), PlayerCount
    //   copied from the championship, participants copied from
    //   ChampionshipParticipants. Sets championship.status = in_progress on the
    //   first call.

    // (Match completion itself goes through the existing match-close flow — see
    // GameHub / a future MatchController — which sets Placement and Points on each
    // MatchParticipant. After that flow closes a championship match, it must call
    // into the standings check below before returning.)

    // GET /api/championships/{id}/standings
    //   Runs the standings query (docs/database-schema.md):
    //     SUM(points), SUM(kills), COUNT(placement=1) per participant,
    //     ordered by points DESC, kills DESC, matches_won DESC.
    //   Used both for display and, server-side, after each match closes, to check
    //   whether anyone has reached target_score:
    //     - Nobody at/above target_score  -> championship continues.
    //     - Exactly one participant       -> they're champion; set
    //                                        championship.{status=completed,
    //                                        winner_id, completed_at}.
    //     - Multiple, unequal totals      -> highest total wins outright (e.g.
    //                                        dark=11 vs green=12 in the same
    //                                        match — no tie-break needed).
    //     - Multiple, EXACT tie           -> run the tie-break cascade:
    //         1. more kills (already in the standings row)
    //         2. more matches won (already in the standings row)
    //         3. head-to-head: pairwise "who placed better how many times" among
    //            the tied players' shared matches (NOT sum of shared points --
    //            that's always equal to the tied total in a fixed-roster
    //            championship and resolves nothing; see docs/database-schema.md
    //            for why, verified against a real database while designing this).
    //         4. still tied -> schedule a sudden-death decider match (another
    //            Match row, ChampionshipId set, participants = only the tied
    //            players); its winner is champion outright.

    // GET /api/championships/{id}
    //   Championship detail: roster, status, match history, current standings.
}
