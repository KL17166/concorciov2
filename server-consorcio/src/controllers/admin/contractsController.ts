import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { paginate, paginationMeta, buildPageUrl } from '../../utils/pagination';
import { createSubscription } from '../../application/subscriptions/createSubscription';
import { contemplateSubscription as contemplateSubUseCase } from '../../application/subscriptions/contemplateSubscription';
import { cancelSubscription as cancelSubUseCase } from '../../application/subscriptions/cancelSubscription';

// GET /admin/contracts - Lista todos os contratos
export const getContracts = async (req: Request, res: Response) => {
    try {
        const status = (req.query.status as string) || '';
        const search = (req.query.search as string) || '';
        const { page, limit, skip } = paginate(req);

        const where: any = {};

        if (status) {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { user: { name: { contains: search } } },
                { user: { cpf: { contains: search } } },
                { groupNumber: { contains: search } },
                { quotaNumber: { contains: search } }
            ];
        }

        const [contracts, total, totalActive, totalContemplated, totalPending] = await Promise.all([
            prisma.subscription.findMany({
                where,
                include: {
                    user: true,
                    plan: {
                        include: {
                            product: true
                        }
                    },
                    installments: {
                        orderBy: { number: 'asc' }
                    },
                    bids: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.subscription.count({ where }),
            prisma.subscription.count({ where: { ...where, status: 'ACTIVE' } }),
            prisma.subscription.count({ where: { ...where, contemplated: true } }),
            prisma.subscription.count({ where: { ...where, status: 'PENDING' } })
        ]);

        const pagination = paginationMeta(total, page, limit);

        res.render('pages/contracts/index', {
            path: '/contracts',
            contracts,
            summary: {
                totalActive,
                totalContemplated,
                totalPending,
                total
            },
            status,
            search,
            pagination,
            buildPageUrl: (p: number) => buildPageUrl('/admin/contracts', req.query as Record<string, any>, p)
        });
    } catch (error) {
        logger.error(error);
        res.status(500).send('Erro ao carregar contratos');
    }
};

// GET /admin/contracts/:id - Detalhes do contrato
export const getContractDetails = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        const contract = await prisma.subscription.findUnique({
            where: { id },
            include: {
                user: true,
                plan: {
                    include: {
                        product: true
                    }
                },
                installments: {
                    orderBy: { number: 'asc' }
                },
                bids: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!contract) {
            req.flash('error_msg', 'Contrato não encontrado');
            return res.redirect('/admin/contracts');
        }

        // Calculate progress from actual installment records
        const paidInstallments = contract.installments.filter((i: any) => i.status === 'PAID').length;

        const totalPaid = contract.installments
            .filter((i: any) => i.status === 'PAID')
            .reduce((sum: number, i: any) => sum + Number(i.amount), 0);

        const progress = contract.totalInstallments > 0
            ? (paidInstallments / contract.totalInstallments) * 100
            : 0;

        res.render('pages/contracts/details', {
            path: '/contracts',
            contract,
            stats: {
                paidInstallments,
                totalPaid,
                progress: progress.toFixed(1)
            }
        });
    } catch (error) {
        logger.error(error);
        req.flash('error_msg', 'Erro ao carregar contrato');
        res.redirect('/admin/contracts');
    }
};

// GET /admin/contracts/new - Formulário de novo contrato
export const getNewContract = async (req: Request, res: Response) => {
    try {
        const clientId = (req.query.clientId as string)?.trim() || '';
        logger.info('Pre-selecting client via URL:', clientId);

        const clients = await prisma.user.findMany({
            where: { role: 'CLIENT' },
            orderBy: { name: 'asc' }
        });

        const plans = await prisma.consortiumPlan.findMany({
            where: { active: true },
            include: {
                product: true
            },
            orderBy: { name: 'asc' }
        });

        res.render('pages/contracts/form', {
            path: '/contracts',
            editing: false,
            clients,
            clientId,
            plans
        });
    } catch (error) {
        logger.error(error);
        res.status(500).send('Erro ao carregar formulário');
    }
};

// POST /admin/contracts/new - Criar contrato
export const createContract = async (req: Request, res: Response) => {
    try {
        const { userId, planId, groupNumber, quotaNumber } = req.body;

        const result = await createSubscription({
            userId,
            planId,
            groupNumber,
            quotaNumber,
            channel: 'ADMIN_PANEL'
        });

        req.flash('success_msg', 'Contrato criado com sucesso!');
        res.redirect(`/admin/contracts/${result.subscription.id}`);
    } catch (error: any) {
        logger.error('Error creating contract via admin:', error);
        req.flash('error_msg', error.message || 'Erro ao criar contrato');
        res.redirect('/admin/contracts/new');
    }
};

// POST /admin/contracts/:id/contemplate - Contemplar contrato
export const contemplateContract = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const { contemplationType } = req.body;

        await contemplateSubUseCase({
            subscriptionId: id,
            contemplationType: contemplationType || 'DIRECT'
        });

        req.flash('success_msg', 'Contrato contemplado com sucesso!');
        res.redirect(`/admin/contracts/${id}`);
    } catch (error: any) {
        logger.error('Error contemplating contract via admin:', error);
        req.flash('error_msg', error.message || 'Erro ao contemplar contrato');
        res.redirect(`/admin/contracts/${id}`);
    }
};

// POST /admin/contracts/:id/cancel - Cancelar contrato
export const cancelContract = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const sessionUser = (req as any).session?.user;
    try {
        const result = await cancelSubUseCase({
            subscriptionId: id,
            requesterUserId: sessionUser?.id || 'admin',
            requesterRole: (sessionUser?.role as any) || 'MASTER'
        });

        req.flash('success_msg', result.message || 'Contrato cancelado');
        res.redirect(`/admin/contracts/${id}`);
    } catch (error: any) {
        logger.error('Error cancelling contract via admin:', error);
        req.flash('error_msg', error.message || 'Erro ao cancelar contrato');
        res.redirect(`/admin/contracts/${id}`);
    }
};
