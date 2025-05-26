import React, { act } from 'react';
import fs from 'fs';
import { fireEvent, render, renderHook, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileProvider, useProfile } from '../context/ProfileContext';
import FormProfile from '../components/FormProfile';
import { Profile } from '../types/Profile';
import { formText } from '../assets/uiText/form';
import App from '../App';

const initialValues: Profile = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: { year: 2000, month: 'Jan', date: 1 },
    weight: '',
    height: '',
    gender: 'Male',
    weightUnit: 'Kg',
    heightUnit: 'Cm',
    role: 'User'
};
beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation((msg) => {
        if (
            typeof msg === 'string' &&
            msg.includes('[antd: Spin] `tip` only work in nest or fullscreen pattern.')
        ) return;
        console.error(msg);
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

test('throws error when used outside ProfileProvider', () => {
    try {
        renderHook(() => useProfile());
    } catch (error) {
        expect(error).toEqual(
            Error('useProfile must be used within a ProfileProvider')
        );
    }
});

test('renders required fields in create mode', () => {
    render(
        <ProfileProvider>
            <FormProfile onSubmit={jest.fn()} mode="create" initialValues={initialValues} editing={false} />
        </ProfileProvider>
    );
    fs.writeFileSync('test-form.html', document.body.innerHTML, 'utf8');
    expect(screen.getByPlaceholderText(formText.placeholders.firstName)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(formText.placeholders.lastName)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(formText.placeholders.email)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(formText.placeholders.phone)).toBeInTheDocument();
    expect(screen.getByText(initialValues.gender)).toBeInTheDocument();
    expect(screen.getByText(initialValues.dob.year)).toBeInTheDocument();
    expect(screen.getByText(initialValues.dob.month)).toBeInTheDocument();
    expect(screen.getByText(initialValues.dob.date)).toBeInTheDocument();
    expect(screen.getByText(initialValues.weightUnit)).toBeInTheDocument();
    expect(screen.getByText(initialValues.heightUnit)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(formText.placeholders.weight)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(formText.placeholders.height)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: formText.buttons.save })).toBeDisabled();
});
test('calls onSubmit with correct values', async () => {
    const handleSubmit = jest.fn();

    render(
        <ProfileProvider>
            <FormProfile onSubmit={handleSubmit} mode="create" initialValues={initialValues} editing={false} />
        </ProfileProvider>
    );

    await userEvent.type(screen.getByPlaceholderText(formText.placeholders.firstName), 'John');
    await userEvent.type(screen.getByPlaceholderText(formText.placeholders.lastName), 'Doe');
    await userEvent.type(screen.getByPlaceholderText(formText.placeholders.email), 'john@example.com');
    await userEvent.type(screen.getByPlaceholderText(formText.placeholders.phone), '1234567890');
    await userEvent.type(screen.getByPlaceholderText(formText.placeholders.weight), '100');
    await userEvent.type(screen.getByPlaceholderText(formText.placeholders.height), '150');
    jest.spyOn(window, 'alert').mockImplementation(() => { });
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const checkbox = document.querySelector('.ant-checkbox-input') as HTMLInputElement;
    await userEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    const submitbtn = screen.getByRole('button', { name: formText.buttons.save });
    expect(submitbtn).not.toBeDisabled();

    fireEvent.click(submitbtn);

    await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalled();
    });
}, 10000);

test('opens policy modal when consent link is clicked', async () => {
    render(
        <ProfileProvider>
            <FormProfile onSubmit={jest.fn()} mode="create" initialValues={initialValues} editing={false} />
        </ProfileProvider>
    );

    const link = screen.getByText(formText.message.consent);
    expect(link).toBeInTheDocument();
    await userEvent.click(link);

    expect(await screen.findByText(formText.headings.consentCaution)).toBeInTheDocument();
    fs.writeFileSync('test-form4.html', document.body.innerHTML, 'utf8');
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await userEvent.click(link);
    const returnbut = screen.getByText('← Return to profile form');
    fireEvent.click(returnbut);
    await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

test('opens reset password modal when link is clicked', async () => {
    render(
        <ProfileProvider>
            <FormProfile onSubmit={jest.fn()} mode="create" initialValues={initialValues} editing={false} />
        </ProfileProvider>
    );

    const link = screen.getByText(/Reset Password/i);
    await userEvent.click(link);

    expect(await screen.findByText(/New Password/i)).toBeInTheDocument();
    const passwordInput = screen.getByPlaceholderText(/Enter new password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');
    const eye = screen.getAllByText(/🙈/)[0];
    await userEvent.click(eye);
    expect(await screen.findByText(/👁️/i)).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'text');
    await userEvent.click(eye);
    const repasswordInput = screen.getByPlaceholderText(/Confirm password/i);
    expect(repasswordInput).toHaveAttribute('type', 'password');
    const eye2 = screen.getAllByText(/🙈/)[1];
    await userEvent.click(eye2);
    expect(await screen.findByText(/👁️/i)).toBeInTheDocument();
    expect(repasswordInput).toHaveAttribute('type', 'text');
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
test('updates feet input and height correctly', async () => {
    const values: Profile = {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dob: { year: 2000, month: 'Jan', date: 1 },
        weight: '',
        height: '',
        gender: 'Male',
        weightUnit: 'Lb',
        heightUnit: 'ft',
        role: 'User'
    };
    render(
        <ProfileProvider>
            <FormProfile onSubmit={jest.fn()} mode="create" initialValues={values} editing={false} />
        </ProfileProvider>
    );

    const feetInput = document.getElementById('height-ft') as HTMLInputElement;
    const inchesInput = document.getElementById('height-inch') as HTMLInputElement;
    // Set inches to 6
    userEvent.clear(inchesInput);
    userEvent.type(inchesInput, '6');


    await userEvent.clear(feetInput);
    await userEvent.type(feetInput, '5');

    await waitFor(() => {
        expect(feetInput.value).toBe('5');
        expect(inchesInput.value).toBe('6');
    });
    fs.writeFileSync('test-unit.html', document.body.innerHTML, 'utf8');

    await userEvent.clear(feetInput);
    await userEvent.type(feetInput, '-2');
    await waitFor(() => {
        expect(feetInput.value).toBe('2');
    });
});
test('updates units for weight field', async () => {
    render(
        <ProfileProvider>
            <FormProfile onSubmit={jest.fn()} mode="create" initialValues={initialValues} editing={false} />
        </ProfileProvider>
    );

    const weightInput = screen.getByPlaceholderText(formText.placeholders.weight) as HTMLInputElement;
    await userEvent.type(weightInput, '100');
    const trigger = screen.getByTitle('Kg');
    fireEvent.mouseDown(trigger);
    const lbOption = screen.getAllByText('Lb')[1];
    await userEvent.click(lbOption);
    await waitFor(() => {
        expect(screen.getAllByText('Lb')[0]).toBeInTheDocument();

    });
    await waitFor(() => {
        expect(screen.getAllByText('ft')[0]).toBeInTheDocument();
    });
    expect(weightInput.value).toBe('220.46');
    const reversetrigger = screen.getAllByText('Lb')[1];
    fireEvent.mouseDown(reversetrigger);
    const kgOption = screen.getAllByText('Kg')[1];
    await userEvent.click(kgOption);

    await waitFor(() => {
        expect(screen.getAllByText('Kg')[0]).toBeInTheDocument();

    });
    await waitFor(() => {
        expect(screen.getAllByText('Cm')[0]).toBeInTheDocument();
    });
    expect(weightInput.value).toBe('100');
});

test('updates units for height field', async () => {
    render(
        <ProfileProvider>
            <FormProfile onSubmit={jest.fn()} mode="create" initialValues={initialValues} editing={false} />
        </ProfileProvider>
    );
    fs.writeFileSync('test-pform.html', document.body.innerHTML, 'utf8');
    const trigger = screen.getByTitle('Cm');
    fireEvent.mouseDown(trigger); // triggers the dropdown reliably
    fs.writeFileSync('test-form.html', document.body.innerHTML, 'utf8');
    const ftOption = screen.getAllByText('ft')[1];
    await userEvent.click(ftOption);
    fs.writeFileSync('test-form.html', document.body.innerHTML, 'utf8');

    await waitFor(() => {
        expect(screen.getAllByText('Lb')[0]).toBeInTheDocument();

    });
    await waitFor(() => {
        expect(screen.getAllByText('ft')[0]).toBeInTheDocument();
    });
    const reversetrigger = screen.getAllByText('ft')[0];
    fireEvent.mouseDown(reversetrigger);

    const CmOption = screen.getAllByText('Cm')[1];
    await userEvent.click(CmOption);

    await waitFor(() => {
        expect(screen.getAllByText('Kg')[0]).toBeInTheDocument();

    });
    await waitFor(() => {
        expect(screen.getAllByText('Cm')[0]).toBeInTheDocument();
    });
});
test('calls addProfile when submitting new profile via form', async () => {
    const addProfileMock = jest.fn();
    const updateProfileMock = jest.fn();

    // Mock useProfile to return your spy functions
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.spyOn(require('../context/ProfileContext'), 'useProfile').mockReturnValue({
        addProfile: addProfileMock,
        updateProfile: updateProfileMock,
        deleteProfile: jest.fn(),
        profiles: [],
    });

    render(<App />);

    fireEvent.click(screen.getByText('Create Profile'));
    fireEvent.change(screen.getByPlaceholderText(/first name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByPlaceholderText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter email/i), { target: { value: 'john.doe@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter phone number/i), { target: { value: '1234567890' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter weight/i), { target: { value: 70 } });
    fireEvent.change(screen.getByPlaceholderText(/Enter height/i), { target: { value: 180 } });

    fireEvent.click(screen.getByRole('checkbox'));

    const saveButton = screen.getByRole('button', { name: /save/i });

    await act(async () => {
        fireEvent.click(saveButton);
    });

    expect(addProfileMock).toHaveBeenCalledTimes(1);
});

test('enables save button when table is edit', async () => {
    render(
        <ProfileProvider>
            <FormProfile onSubmit={jest.fn()} mode="table" initialValues={initialValues} editing={false} />
        </ProfileProvider>
    );
    const submit = screen.getByRole('button', { name: formText.buttons.save });
    expect(submit).toBeEnabled();

});

const mockProfile1 = {
    firstName: "Bob",
    lastName: "Davis",
    email: "bob.davis@example.com",
    phone: "9441451406",
    dob: { year: 1990, month: "05", date: 13 },
    weight: 70.8,
    height: 184.3,
    gender: "Female",
    weightUnit: "Kg",
    heightUnit: "ft",
    role: "User",
    managedBy: [
        {
            firstName: "Ethan",
            lastName: "Brown",
            email: "ethan.brown@example.com",
            phone: "",
            dob: { year: 0, month: "", date: 0 },
            weight: "",
            height: "",
            gender: "",
            weightUnit: "Kg",
            heightUnit: "ft",
            role: "User",
        },
    ],
} satisfies Profile;

const mockProfile2 = {
    firstName: "Jane",
    lastName: "Rodriguez",
    email: "bob.davis@example.com",
    phone: "7360067230",
    dob: { year: 1974, month: "03", date: 26 },
    weight: 109.4,
    height: 195.7,
    gender: "Male",
    weightUnit: "Kg",
    heightUnit: "ft",
    role: "Admin",
    managedBy: [
        {
            firstName: "Jane",
            lastName: "Brown",
            email: "jane.brown@example.com",
            phone: "",
            dob: { year: 0, month: "", date: 0 },
            weight: "",
            height: "",
            gender: "",
            weightUnit: "Kg",
            heightUnit: "ft",
            role: "User",
        },
        {
            firstName: "Ethan",
            lastName: "Jones",
            email: "ethan.jones@example.com",
            phone: "",
            dob: { year: 0, month: "", date: 0 },
            weight: "",
            height: "",
            gender: "",
            weightUnit: "Kg",
            heightUnit: "ft",
            role: "User",
        },
    ],
} satisfies Profile;
const mockProfile3 = {
    firstName: "Aditya",
    lastName: "M",
    email: "aditya.m@example.com",
    phone: "7360067230",
    dob: { year: 1974, month: "03", date: 26 },
    weight: 109.4,
    height: 195.7,
    gender: "Male",
    weightUnit: "Kg",
    heightUnit: "ft",
    role: "Admin",
    managedBy: [
        {
            firstName: "Jane",
            lastName: "Brown",
            email: "jane.brown@example.com",
            phone: "",
            dob: { year: 0, month: "", date: 0 },
            weight: "",
            height: "",
            gender: "",
            weightUnit: "Kg",
            heightUnit: "ft",
            role: "User",
        },
        {
            firstName: "Ethan",
            lastName: "Jones",
            email: "ethan.jones@example.com",
            phone: "",
            dob: { year: 0, month: "", date: 0 },
            weight: "",
            height: "",
            gender: "",
            weightUnit: "Kg",
            heightUnit: "ft",
            role: "User",
        },
    ],
} satisfies Profile;
function TestComponent() {
    const profileContext = useProfile();

    const { profiles, addProfile, updateProfile, deleteProfile } = profileContext;

    return (
        <div>
            <button onClick={() => { addProfile(mockProfile1); addProfile(mockProfile3) }}>Add</button>
            <button onClick={() => updateProfile(mockProfile1, mockProfile2)}>Update</button>
            <button onClick={() => deleteProfile(mockProfile2)}>Delete</button>

            <ul data-testid="profile-list">
                {profiles.map((p) => (
                    <li key={p.email}>{p.firstName} - {p.email}</li>
                ))}
            </ul>
        </div>
    );
}

test('add, update, and delete profile using full profile structure', async () => {
    render(
        <ProfileProvider>
            <TestComponent />
        </ProfileProvider>
    );

    const addBtn = screen.getByText('Add');
    const updateBtn = screen.getByText('Update');
    const deleteBtn = screen.getByText('Delete');

    // Add profile
    await userEvent.click(addBtn);
    expect(screen.getByText(/Bob - bob\.davis@example\.com/i)).toBeInTheDocument();

    // Update profile
    await userEvent.click(updateBtn);
    expect(screen.getByText(/Jane - bob\.davis@example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Aditya - aditya\.m@example\.com/i)).toBeInTheDocument();

    // Delete profile
    await userEvent.click(deleteBtn);
    expect(screen.queryByText(/Jane - bob\.davis@example\.com/i)).not.toBeInTheDocument();
});

//Mock Profile
const mockProfile = {
    firstName: "Bob",
    lastName: "Davis",
    email: "bob.davis@example.com",
    phone: "9441451406",
    dob: { year: 1990, month: "05", date: 13 },
    weight: 70.8,
    height: 184.3,
    gender: "Female",
    weightUnit: "Kg",
    heightUnit: "ft",
    role: "User",
    managedBy: [
        {
            firstName: "Ethan",
            lastName: "Brown",
            email: "ethan.brown@example.com",
            phone: "",
            dob: { year: 0, month: "", date: 0 },
            weight: "",
            height: "",
            gender: "",
            weightUnit: "Kg",
            heightUnit: "ft",
            role: "User",
        },
    ],
} satisfies Profile;


test('calls deleteProfile when onDelete is triggered', async () => {
    const deleteMock = jest.fn();
    const fetchProfilesMock = jest.fn();
    jest.spyOn(window, 'confirm').mockImplementation(() => true);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.spyOn(require('../context/ProfileContext'), 'useProfile').mockReturnValue({
        addProfile: jest.fn(),
        updateProfile: jest.fn(),
        fetchProfiles: fetchProfilesMock,
        deleteProfile: deleteMock,
        profiles: [mockProfile],
    });

    render(<App />);

    fireEvent.click(screen.getByText('Show Table'));

    await waitForElementToBeRemoved(() => document.querySelector('.antd-loader-container'));
    fs.writeFileSync('test-form.html', document.body.innerHTML, 'utf8');
    const deleteIcon = screen.getByTitle('Delete');
    await userEvent.click(deleteIcon);


    expect(window.confirm).toHaveBeenCalledWith('Delete Bob Davis?');
    expect(deleteMock).toHaveBeenCalled();

    // Clean up the mock
    (window.confirm as jest.Mock).mockRestore();
});

test('onEdit opens the modal and switches to table mode', async () => {
    const updateMock = jest.fn();
    const fetchProfilesMock = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.spyOn(require('../context/ProfileContext'), 'useProfile').mockReturnValue({
        addProfile: jest.fn(),
        updateProfile: updateMock,
        fetchProfiles: fetchProfilesMock,
        deleteProfile: jest.fn(),
        profiles: [mockProfile],
    });

    render(<App />);

    fireEvent.click(screen.getByText('Show Table'));
    await waitForElementToBeRemoved(() => document.querySelector('.antd-loader-container'));
    const editIcon = screen.getByTitle('Edit');
    await userEvent.click(editIcon);

    expect(screen.getByDisplayValue('bob.davis@example.com')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: formText.buttons.save });
    expect(submit).toBeEnabled();
    await act(async () => {
        fireEvent.click(submit);
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    await userEvent.click(editIcon);
    fs.writeFileSync('test-form4.html', document.body.innerHTML, 'utf8');
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
