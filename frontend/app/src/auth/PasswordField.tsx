import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { useState, type ReactNode } from 'react';

interface PasswordFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    autoComplete?: string;
    error?: boolean;
    helperText?: ReactNode;
    required?: boolean;
    autoFocus?: boolean;
}

/** TextField with a show/hide toggle for password inputs. */
export function PasswordField({
    id,
    label,
    value,
    onChange,
    autoComplete,
    error,
    helperText,
    required,
    autoFocus,
}: PasswordFieldProps) {
    const [visible, setVisible] = useState(false);

    return (
        <TextField
            id={id}
            label={label}
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            error={error}
            helperText={helperText}
            required={required}
            autoFocus={autoFocus}
            fullWidth
            slotProps={{
                input: {
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                aria-label={
                                    visible ? 'Hide password' : 'Show password'
                                }
                                onClick={() => setVisible((v) => !v)}
                                edge="end"
                                size="small"
                            >
                                {visible ? (
                                    <VisibilityOff fontSize="small" />
                                ) : (
                                    <Visibility fontSize="small" />
                                )}
                            </IconButton>
                        </InputAdornment>
                    ),
                },
            }}
        />
    );
}
