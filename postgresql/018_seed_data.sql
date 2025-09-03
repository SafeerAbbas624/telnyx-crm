-- Seed data for development and testing

-- Insert sample contacts
INSERT INTO contacts (
    id, first_name, last_name, llc_name, phone1, email1, 
    property_address, city, state, zip_code, property_type,
    bedrooms, total_bathrooms, building_sqft, effective_year_built,
    est_value, debt_owed, est_equity, deal_status, notes
) VALUES 
(
    '550e8400-e29b-41d4-a716-446655440001',
    'John', 'Smith', 'Smith Properties LLC', '+15551234567', 'john.smith@email.com',
    '123 Main St', 'Austin', 'TX', '78701', 'Single Family',
    3, 2.0, 1800, 2010, 450000, 320000, 130000, 'qualified',
    'Interested in selling, motivated seller'
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    'Sarah', 'Johnson', NULL, '+15559876543', 'sarah.j@email.com',
    '456 Oak Ave', 'Dallas', 'TX', '75201', 'Townhouse',
    2, 1.5, 1200, 2015, 280000, 180000, 100000, 'lead',
    'First time contact, needs follow up'
),
(
    '550e8400-e29b-41d4-a716-446655440003',
    'Michael', 'Davis', 'Davis Investments', '+15555551234', 'mike@davisinvest.com',
    '789 Pine Rd', 'Houston', 'TX', '77001', 'Multi-Family',
    8, 4.0, 3200, 2005, 650000, 400000, 250000, 'proposal',
    'Investor looking for quick sale'
);

-- Insert sample tags and associate with contacts
INSERT INTO contact_tags (contact_id, tag_id) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'tag1'), -- Hot Lead
('550e8400-e29b-41d4-a716-446655440001', 'tag6'), -- Single-Family
('550e8400-e29b-41d4-a716-446655440002', 'tag2'), -- Cold Lead
('550e8400-e29b-41d4-a716-446655440003', 'tag3'), -- Investor
('550e8400-e29b-41d4-a716-446655440003', 'tag5'); -- Multi-Family

-- Insert sample deals
INSERT INTO deals (
    id, contact_id, name, stage, value, probability, 
    expected_close_date, source, notes
) VALUES
(
    '660e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'Smith Property Purchase', 'qualified', 450000, 75,
    CURRENT_DATE + INTERVAL '30 days', 'Cold Call',
    'Ready to close quickly'
),
(
    '660e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440003',
    'Davis Multi-Family Deal', 'proposal', 650000, 60,
    CURRENT_DATE + INTERVAL '45 days', 'Referral',
    'Investor deal, cash purchase'
);

-- Insert sample activities
INSERT INTO activities (
    contact_id, deal_id, type, title, description, 
    due_date, status, priority
) VALUES
(
    '550e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440001',
    'call', 'Follow up call with John Smith',
    'Discuss contract terms and closing timeline',
    CURRENT_TIMESTAMP + INTERVAL '2 days', 'planned', 'high'
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    NULL,
    'email', 'Send property information to Sarah',
    'Email comparable sales and market analysis',
    CURRENT_TIMESTAMP + INTERVAL '1 day', 'planned', 'medium'
),
(
    '550e8400-e29b-41d4-a716-446655440003',
    '660e8400-e29b-41d4-a716-446655440002',
    'meeting', 'Property walkthrough with Michael',
    'Schedule and conduct property inspection',
    CURRENT_TIMESTAMP + INTERVAL '5 days', 'planned', 'high'
);

-- Insert sample messages
INSERT INTO messages (
    contact_id, direction, content, phone_number, status
) VALUES
(
    '550e8400-e29b-41d4-a716-446655440001',
    'outbound', 'Hi John, following up on our conversation about your property. Are you still interested in selling?',
    '+15551234567', 'delivered'
),
(
    '550e8400-e29b-41d4-a716-446655440001',
    'inbound', 'Yes, very interested! When can we meet to discuss?',
    '+15551234567', 'read'
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    'outbound', 'Hello Sarah, I have some great information about your property value. Would you like to see it?',
    '+15559876543', 'sent'
);

-- Insert sample calls
INSERT INTO calls (
    contact_id, direction, duration, status, notes
) VALUES
(
    '550e8400-e29b-41d4-a716-446655440001',
    'outbound', 420, 'completed',
    'Great conversation, very motivated seller. Scheduling property visit.'
),
(
    '550e8400-e29b-41d4-a716-446655440003',
    'inbound', 180, 'completed',
    'Investor called about multi-family property. Interested in cash deal.'
);

-- Insert sample assistant
INSERT INTO assistants (
    id, name, description, first_message, system_prompt, voice_id
) VALUES
(
    '770e8400-e29b-41d4-a716-446655440001',
    'Real Estate Assistant',
    'AI assistant for real estate lead qualification',
    'Hi! I''m calling about your property. Do you have a few minutes to chat?',
    'You are a friendly real estate assistant helping to qualify leads and schedule appointments.',
    'jennifer'
);

-- Insert sample phone number
INSERT INTO phone_numbers (
    id, number, formatted_number, assistant_id, name
) VALUES
(
    '880e8400-e29b-41d4-a716-446655440001',
    '+15551112222', '(555) 111-2222',
    '770e8400-e29b-41d4-a716-446655440001',
    'Main Business Line'
);
