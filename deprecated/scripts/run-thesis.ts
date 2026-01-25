import { auditAndThesisForNewSignals } from '../ml/src/auditThesis.ts';
(async () => {
  const res = await auditAndThesisForNewSignals({ take: 50 });
  console.log('[thesis]', res);
})();

