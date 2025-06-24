-- Add check_column_exists function
CREATE OR REPLACE FUNCTION check_column_exists(
        schema_name text,
        table_name text,
        column_name text
    ) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE column_exists boolean;
BEGIN
SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = schema_name
            AND table_name = table_name
            AND column_name = column_name
    ) INTO column_exists;
RETURN column_exists;
END;
$$;
-- Function to create the check_column_exists function
CREATE OR REPLACE FUNCTION create_check_column_function() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN EXECUTE '
    CREATE OR REPLACE FUNCTION check_column_exists(
        schema_name text, 
        table_name text, 
        column_name text
    ) 
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    DECLARE
        column_exists boolean;
    BEGIN
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = schema_name
              AND table_name = table_name
              AND column_name = column_name
        ) INTO column_exists;
        
        RETURN column_exists;
    END;
    $func$;
    ';
END;
$$;