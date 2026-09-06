const express = require('express');

const { buildError } = require('../auth/sessionAuth.cjs');

function createUsoapRouter({ auth, alfrescoClient }) {
  const router = express.Router();

  router.post(
    '/direct-tag',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'reporter', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const nodeId = String(req.body?.nodeId || '').trim();
        if (!nodeId) {
          return res.status(400).json(buildError('USOAP_DIRECT_TAG_BAD_REQUEST', 'nodeId is required'));
        }

        const result = await alfrescoClient.applyDirectUsoapTag({
          ticket: req.auth.ticket,
          nodeId,
          criticalElement: req.body?.criticalElement,
          areaCode: req.body?.areaCode,
          ceMapping: req.body?.ceMapping,
          areaMapping: req.body?.areaMapping,
          pqReferences: req.body?.pqReferences,
          evidenceBasis: req.body?.evidenceBasis,
        });

        return res.status(200).json(result);
      } catch (error) {
        const upstreamStatus = Number(error?.response?.status || 0);
        const upstreamDetail = error?.response?.data?.error || error?.response?.data?.message || error.message;

        if (upstreamStatus >= 400 && upstreamStatus < 500) {
          return res.status(400).json(buildError('USOAP_DIRECT_TAG_BAD_REQUEST', upstreamDetail));
        }

        return res.status(502).json(buildError('USOAP_DIRECT_TAG_FAILED', upstreamDetail));
      }
    }
  );

  return router;
}

module.exports = {
  createUsoapRouter,
};
