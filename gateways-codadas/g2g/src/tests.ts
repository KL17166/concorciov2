import * as assert from 'assert';
import { Offer } from './types';
import { evaluateOffer, findBestOffer } from './optimizer';
import { buildBuyNowBody, collectDeliveryFields } from './g2g';
import { toItemId, toOrderId, AUTO_CANCEL_DEFAULT_MS } from './cancel';

function runTests() {
    console.log('🧪 G2G - Testes do otimizador por unidade...\n');

    // Caso real validado na sls: Silvermoon EU - WOW Gold
    const offer: Offer = {
        sellerName: 'EternalStock',
        pricePerUnit: 0.213922,
        inStock: 9256971,
        minQty: 200,
        deliveryTime: 'instant',
        ratingPercent: 100,
        reviewCount: 5000,
        isVerified: true,
        isMainOffer: false,
        elementIndex: 0
    };

    const r = evaluateOffer(offer, 3500, false, 0, 0);
    assert.strictEqual(r.isValid, true);
    assert.strictEqual(r.unitsToBuy, 16361);
    assert.strictEqual(r.totalCost, 3499.98);
    console.log('✔ G2G 3500 @ 0.213922/un -> 16361un = 3499.98: PASSOU');

    const { best } = findBestOffer([offer], 3500, 0, false, false, 0, 0);
    assert.ok(best !== null);
    assert.strictEqual(best?.unitsToBuy, 16361);
    console.log('✔ Ranking G2G: PASSOU');

    // Corpo do buy-now espelhado na captura real (offer Silvermoon/EternalStock).
    // product_settings entrega 1 campo delivery_info_1 (Character Name).
    const fields = collectDeliveryFields(
        {
            results: [
                {
                    product_settings_type: 'delivery_method',
                    results: [
                        {
                            product_settings_id: '8bd2d339-44a1-4564-b19c-ba932f33cfb7',
                            product_settings_type: 'delivery_method',
                            product_settings: {
                                form_attributes: [
                                    {
                                        attribute_key: 'delivery_info_1',
                                        collection_id: '4fc60dc7',
                                        label: { en: 'World Of Warcraft - Character Name' },
                                    },
                                ],
                            },
                        },
                    ],
                },
                {
                    product_settings_type: 'purchase_form',
                    results: [
                        {
                            product_settings_id: 'x',
                            product_settings: { form_attributes: [{ attribute_key: 'additional_info_1', collection_id: '510b91cf' }] },
                        },
                    ],
                },
            ],
        },
        '8bd2d339-44a1-4564-b19c-ba932f33cfb7'
    );
    assert.strictEqual(fields.length, 1);
    assert.strictEqual(fields[0].collection_id, '4fc60dc7');

    const body: any = buildBuyNowBody({
        userId: '1004386074',
        offerId: 'G1744088792265KM',
        sellerId: '493848',
        quantity: 2000,
        unitPrice: 0.0479,
        offerCurrency: 'USD',
        deliveryMethodId: '8bd2d339-44a1-4564-b19c-ba932f33cfb7',
        deliveryFields: fields,
        deliveryValuesByLabel: { 'World Of Warcraft - Character Name': 'LEA' },
    });
    assert.strictEqual(body.product_type, 'Offer');
    assert.strictEqual(body.product.offer_id, 'G1744088792265KM');
    assert.strictEqual(body.product.quantity, 2000);
    assert.strictEqual(body.currency, 'BRL');
    assert.strictEqual(body.language, 'pt');
    assert.strictEqual(body.checkout_info.delivery_method_details.delivery_info[0].collection_id, '4fc60dc7');
    assert.strictEqual(body.checkout_info.delivery_method_details.delivery_info[0].value, 'LEA');
    assert.strictEqual(body.checkout_info.gp_checkout_info.gp_used, 0);
    assert.strictEqual(JSON.stringify(body).length, 467);
    console.log('✔ buildBuyNowBody fiel à captura (467B): PASSOU');

    // Cancel: normalização de ids + default 10m (offline, sem rede).
    assert.strictEqual(toItemId('1788976894356FT8I'), '1788976894356FT8I-1');
    assert.strictEqual(toItemId('1788976894356FT8I-1'), '1788976894356FT8I-1');
    assert.strictEqual(toOrderId('1788976894356FT8I-1'), '1788976894356FT8I');
    assert.strictEqual(AUTO_CANCEL_DEFAULT_MS, 600000);
    console.log('✔ cancel ids + auto-cancel 10m: PASSOU');

    console.log('\n🎉 Todos os testes G2G passaram!');
}

runTests();
