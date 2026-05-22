/**
 * ESLint Rule: no-direct-health-data-read
 *
 * Enforces that health data reads must use the auditedRead() wrapper
 * from lib/data/audited.ts (FR50 compliance).
 *
 * Catches: client.from('fatigue_responses')[...chain...].select()
 *          and rpc() calls whose names reference health tables.
 *
 * Exemptions: lib/data/audited.ts, lib/actions/audit.ts, eslint-disable-next-line
 */

const HEALTH_TABLES = [
  "fatigue_responses",
  "match_events",
  "readiness_snapshots",
  "session_metrics",
];

function extractTableName(tableArg) {
  if (!tableArg) return null;
  if (tableArg.type === "Literal") return String(tableArg.value);
  // Support template literals with no expressions: `fatigue_responses`
  if (
    tableArg.type === "TemplateLiteral" &&
    tableArg.expressions.length === 0
  ) {
    return tableArg.quasis[0]?.value.raw ?? null;
  }
  return null;
}

function findFromTable(startNode) {
  // Walk up the Supabase call chain to find .from(table):
  // .from('fatigue_responses').eq('id', x).order('created_at').select()
  let current = startNode;
  while (current) {
    if (
      current.type === "CallExpression" &&
      current.callee.type === "MemberExpression" &&
      current.callee.property.name === "from"
    ) {
      return extractTableName(current.arguments[0]);
    }
    if (
      current.type === "CallExpression" &&
      current.callee.type === "MemberExpression"
    ) {
      current = current.callee.object;
    } else {
      break;
    }
  }
  return null;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce auditedRead() wrapper for health data access (FR50 compliance)",
      category: "Best Practices",
      recommended: true,
    },
    fixable: null,
    schema: [],
  },

  create(context) {
    // Normalize path separators for Windows compatibility
    const filename = context.getFilename().replace(/\\/g, "/");

    const isExempted =
      filename.includes("lib/data/audited.ts") ||
      filename.includes("lib/actions/audit.ts");

    if (isExempted) {
      return {};
    }

    return {
      CallExpression(node) {
        // Pattern: client.from('health_table')[...chain...].select()
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.name === "select"
        ) {
          const tableName = findFromTable(node.callee.object);
          if (tableName && HEALTH_TABLES.includes(tableName)) {
            context.report({
              node,
              message: `Direct query of '${tableName}' violates FR50 audit logging. Use auditedRead() wrapper instead.`,
            });
          }
        }

        // Pattern: rpc() calls whose names reference health table operations
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.name === "rpc"
        ) {
          const functionArg = node.arguments[0];
          if (functionArg) {
            const functionName = String(
              extractTableName(functionArg) ?? ""
            ).toLowerCase();

            if (
              functionName.includes("fatigue") ||
              functionName.includes("match_event") ||
              functionName.includes("readiness") ||
              functionName.includes("session_metric") ||
              functionName.includes("health_data")
            ) {
              context.report({
                node,
                message: `RPC call '${functionName}' may query health data. Use auditedRead() wrapper for FR50 compliance.`,
              });
            }
          }
        }
      },
    };
  },
};
