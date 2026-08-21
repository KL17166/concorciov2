import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as peopleController from '../../controllers/admin/peopleController';

const router = Router();

// Compatibilidade: as antigas entradas continuam funcionando, mas agora convergem
// para o diretório único de Pessoas e Contas.
router.get('/clients', isAdmin, requireCapability('people.view'), (_req, res) => res.redirect('/admin/people?role=CLIENT'));
router.get('/users', isAdmin, requireCapability('people.view'), (_req, res) => res.redirect('/admin/people'));
router.get('/clients/new', isAdmin, requireCapability('people.create'), (_req, res) => res.redirect('/admin/people/new?role=CLIENT'));
router.get('/users/new', isAdmin, requireCapability('people.create'), (_req, res) => res.redirect('/admin/people/new?role=CLIENT'));
router.get('/clients/:id', isAdmin, requireCapability('people.view'), (req, res) => res.redirect(`/admin/people/${req.params.id}`));
router.get('/clients/:id/edit', isAdmin, requireCapability('people.edit_profile'), (req, res) => res.redirect(`/admin/people/${req.params.id}/edit`));
router.get('/users/:id/edit', isAdmin, requireCapability('people.edit_profile'), (req, res) => res.redirect(`/admin/people/${req.params.id}/edit`));

router.get('/people', isAdmin, requireCapability('people.view'), peopleController.listPeople);
router.get('/people/new', isAdmin, requireCapability('people.create'), peopleController.newPersonForm);
router.post('/people/new', isAdmin, requireCapability('people.create'), peopleController.createPerson);
router.get('/people/:id', isAdmin, requireCapability('people.view'), peopleController.personDetails);
router.get('/people/:id/edit', isAdmin, requireCapability('people.edit_profile'), peopleController.editPersonForm);
router.post('/people/:id/profile', isAdmin, requireCapability('people.edit_profile'), peopleController.updateProfile);
router.post('/people/:id/access', isAdmin, requireCapability('people.change_role'), peopleController.updateAccess);
router.post('/people/:id/password', isAdmin, requireCapability('people.change_password'), peopleController.changePasswordDirectly);
router.post('/people/:id/reset-password', isAdmin, requireCapability('people.change_password'), peopleController.resetPassword);
router.post('/people/:id/delete', isAdmin, requireCapability('people.delete'), peopleController.deletePerson);

export default router;
